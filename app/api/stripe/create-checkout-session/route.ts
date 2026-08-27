import { NextResponse } from "next/server";
import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { markBookingPaidFromSession } from "@/lib/stripe-payments";
import { calculateKlyxEconomics, getKlyxCommissionPercent } from "@/lib/klyx-economics";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  logServerInfo,
  logServerWarning,
} from "@/lib/server-log";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  service_id: string | null;
  user_service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  currency: string | null;
  pricing_type_snapshot: string | null;
  unit_price_cents: number | null;
  estimated_amount_cents: number | null;
  amount_total: number | null;
  stripe_checkout_session_id: string | null;
};

type PaymentClaimRow = {
  action: "create" | "reuse" | "busy" | "paid";
  checkout_session_id: string | null;
  attempt_number: number;
};

type ProviderRow = {
  country_code: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
};

type ServiceRow = {
  id: string;
  slug: string;
  name: string | null;
};

type ServiceProfileRow = {
  price: number | null;
  pricing_type: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

function envIsTrue(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);

  return hours * 60 + minutes;
}

function serviceLabel(service: ServiceRow): string {
  return service.name?.trim() || service.slug || "Service KLYX";
}
async function claimBookingPayment(
  bookingId: string,
  clientProfileId: string,
  attemptToken: string
): Promise<PaymentClaimRow> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_claim_booking_payment",
    {
      p_booking_id: bookingId,
      p_client_profile_id: clientProfileId,
      p_attempt_token: attemptToken,
    }
  );

  if (error) throw new Error(error.message);

  const claim = ((data ?? []) as PaymentClaimRow[])[0];

  if (!claim) {
    throw new Error("Impossible de verrouiller le paiement.");
  }

  return claim;
}

async function releaseExpiredCheckout(
  bookingId: string,
  checkoutSessionId: string
) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_release_expired_booking_checkout",
    {
      p_booking_id: bookingId,
      p_checkout_session_id: checkoutSessionId,
    }
  );

  if (error) throw new Error(error.message);
  return data === true;
}

async function getBooking(
  bookingId: string
): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, booking_group_id, service_id, user_service_id, booking_date, start_time, end_time, status, payment_status, currency, pricing_type_snapshot, unit_price_cents, estimated_amount_cents, amount_total, stripe_checkout_session_id"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Réservation introuvable.");
  }

  return data as BookingRow;
}

async function resolveService(
  booking: BookingRow,
  providerId: string
): Promise<{
  service: ServiceRow;
  userServiceId: string;
  serviceProfile: ServiceProfileRow;
}> {
  if (!booking.service_id || !booking.user_service_id) {
    throw new Error(
      "Cette ancienne réservation ne contient pas de métier complet. Recrée la réservation avant de payer."
    );
  }

  const [
    { data: serviceData, error: serviceError },
    { data: userServiceData, error: userServiceError },
    { data: serviceProfileData, error: serviceProfileError },
  ] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, slug, name")
      .eq("id", booking.service_id)
      .maybeSingle(),

    supabaseAdmin
      .from("user_services")
      .select("id, user_id, service_id, active")
      .eq("id", booking.user_service_id)
      .eq("user_id", providerId)
      .eq("service_id", booking.service_id)
      .eq("active", true)
      .maybeSingle(),

    supabaseAdmin
      .from("service_profiles")
      .select("price, pricing_type")
      .eq("user_service_id", booking.user_service_id)
      .maybeSingle(),
  ]);

  if (serviceError) {
    throw new Error(serviceError.message);
  }

  if (userServiceError) {
    throw new Error(userServiceError.message);
  }

  if (serviceProfileError) {
    throw new Error(serviceProfileError.message);
  }

  if (!serviceData) {
    throw new Error("Service introuvable.");
  }

  if (!userServiceData) {
    throw new Error(
      "Le métier de cette réservation ne correspond plus au prestataire."
    );
  }

  if (!serviceProfileData) {
    throw new Error("Profil de service introuvable.");
  }

  return {
    service: serviceData as ServiceRow,
    userServiceId: booking.user_service_id,
    serviceProfile: serviceProfileData as ServiceProfileRow,
  };
}
export async function POST(request: Request) {
  // KLYX_SERVER_OBSERVABILITY_12B_8B
  const startedAt = Date.now();

  try {
    const { user, profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const stripeRuntime = assertStripeRuntimeReady();
    const clientMarketAccess = assessKlyxStripeMarketAccess(
      profile.countryCode,
      stripeRuntime.mode
    );

    if (!clientMarketAccess.allowed) {
      return NextResponse.json(
        {
          error:
            "KLYX n'est pas encore ouvert aux paiements réels dans le pays de ce profil client.",
          code: "KLYX_CHECKOUT_MARKET_NOT_READY",
          participant: "client",
          countryCode: clientMarketAccess.countryCode,
          blockers: clientMarketAccess.blockers,
        },
        { status: 409 }
      );
    }

    const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
    const stripe = new Stripe(stripeSecretKey);

    const body = (await request.json()) as {
      bookingId?: string;
    };

    const bookingId = body.bookingId?.trim();

    if (!bookingId) {
      logServerWarning({
        event:
          "stripe_checkout_rejected",
        route:
          "/api/stripe/create-checkout-session",
        method: "POST",
        status: 400,
        code:
          "booking_required",
        durationMs:
          Date.now() -
          startedAt,
      });

      return NextResponse.json(
        { error: "Réservation manquante." },
        { status: 400 }
      );
    }

    const booking = await getBooking(bookingId);

    if (booking.parent_id !== profile.id) {
      return NextResponse.json(
        { error: "Accès refusé." },
        { status: 403 }
      );
    }

    // KLYX_GROUP_PAYMENT_GUARD_12_85
    if (booking.booking_group_id) {
      return NextResponse.json(
        {
          error:
            "Cette reservation appartient a un groupe. Utilise le paiement groupe KLYX.",
          code: "GROUP_PAYMENT_REQUIRED",
          groupId: booking.booking_group_id,
        },
        { status: 409 }
      );
    }
    // KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27
    const {
      data: splitPaymentUnits,
      error: splitPaymentGuardError,
    } = await supabaseAdmin
      .from("split_booking_payment_units")
      .select("id")
      .filter(
        "booking_ids",
        "cs",
        JSON.stringify([booking.id])
      )
      .limit(1);

    if (splitPaymentGuardError) {
      throw new Error(
        splitPaymentGuardError.message
      );
    }

    if (
      (splitPaymentUnits ?? []).length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Le paiement de cette réservation est géré par sa mission multi-prestataires.",
          splitMissionPayment: true,
        },
        {
          status: 409,
        }
      );
    }

    if (booking.status !== "accepted") {
      return NextResponse.json(
        {
          error:
            "La réservation doit être acceptée avant le paiement.",
        },
        { status: 400 }
      );
    }

    if (booking.payment_status === "paid") {
      return NextResponse.json(
        {
          error: "Cette réservation est déjà payée.",
          alreadyPaid: true,
        },
        { status: 409 }
      );
    }

    const providerId =
      booking.provider_id ?? booking.babysitter_id;

    if (!providerId) {
      throw new Error("Prestataire introuvable.");
    }

    const { data: providerData, error: providerError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "country_code, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
        )
        .eq("id", providerId)
        .maybeSingle();

    if (providerError) {
      throw new Error(providerError.message);
    }

    const provider =
      (providerData as ProviderRow | null) ?? null;

    const providerMarketAccess = assessKlyxStripeMarketAccess(
      provider?.country_code ?? "",
      stripeRuntime.mode
    );

    if (!providerMarketAccess.allowed) {
      return NextResponse.json(
        {
          error:
            "KLYX n'est pas encore ouvert aux paiements réels dans le pays de ce prestataire.",
          code: "KLYX_CHECKOUT_MARKET_NOT_READY",
          participant: "provider",
          countryCode: providerMarketAccess.countryCode,
          blockers: providerMarketAccess.blockers,
        },
        { status: 409 }
      );
    }

    let providerStripeAccount: Stripe.Account | null = null;

    if (provider?.stripe_account_id) {
      providerStripeAccount = await stripe.accounts.retrieve(
        provider.stripe_account_id
      );

      const countryAssessment = assessStripeConnectCountry({
        klyxCountryCode: provider.country_code,
        stripeCountryCode: providerStripeAccount.country,
      });

      if (!countryAssessment.matches) {
        return NextResponse.json(
          {
            error:
              "Le pays du compte de paiement du prestataire ne correspond plus à son pays KLYX. Le paiement est bloqué jusqu'à régularisation.",
            code: STRIPE_ACCOUNT_COUNTRY_MISMATCH,
            participant: "provider",
            countryCode: countryAssessment.klyxCountryCode,
            stripeCountryCode: countryAssessment.stripeCountryCode,
          },
          { status: 409 }
        );
      }
    }

    const {
      service,
      userServiceId,
      serviceProfile,
    } = await resolveService(
      booking,
      providerId
    );

    if (serviceProfile.price == null) {
      throw new Error("Prix du service non renseigné.");
    }

    const durationMinutes =
      timeToMinutes(booking.end_time) -
      timeToMinutes(booking.start_time);

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { error: "Durée de réservation invalide." },
        { status: 400 }
      );
    }

    const fallbackAmount = Math.round(
      Number(serviceProfile.price) *
        (serviceProfile.pricing_type === "fixed" ? 1 : durationMinutes / 60) *
        100
    );
    const amountTotal =
      booking.estimated_amount_cents ?? booking.amount_total ?? fallbackAmount;

    if (amountTotal < 50) {
      throw new Error(
        "Le montant calculé est trop faible."
      );
    }
    // KLYX_STRIPE_BOOKING_CURRENCY_14_25
    const checkoutCurrency =
      booking.currency
        ?.trim()
        .toLowerCase() ??
      "";

    if (
      !/^[a-z]{3}$/.test(
        checkoutCurrency
      )
    ) {
      throw new Error(
        "Devise de réservation invalide."
      );
    }
    const economics = calculateKlyxEconomics(
      amountTotal,
      getKlyxCommissionPercent()
    );

    const applicationFeeAmount =
      economics.platformFeeCents;

    const providerReady = Boolean(
      provider?.stripe_account_id &&
        providerStripeAccount?.details_submitted &&
        providerStripeAccount.charges_enabled &&
        providerStripeAccount.payouts_enabled
    );

    const platformOnlyTestAllowed =
      stripeSecretKey.startsWith("sk_test_") &&
      envIsTrue(
        "KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS"
      );

    if (
      !providerReady &&
      !platformOnlyTestAllowed
    ) {
      return NextResponse.json(
        {
          error:
            "Le prestataire doit terminer la vérification Stripe avant de recevoir un paiement.",
        },
        { status: 400 }
      );
    }

    const paymentMode = providerReady
      ? "connect_destination"
      : "platform_test_only";

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
      {
        metadata: {
          booking_id: booking.id,
          provider_id: providerId,
          service_id: service.id,
          service_slug: service.slug,
          user_service_id: userServiceId,
          payment_mode: paymentMode,
        },
      };

    if (
      providerReady &&
      provider?.stripe_account_id
    ) {
      paymentIntentData.application_fee_amount =
        applicationFeeAmount;

      paymentIntentData.transfer_data = {
        destination: provider.stripe_account_id,
      };
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        customer_email: user.email,
        success_url: `${origin}/payment/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/bookings/${booking.id}`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: checkoutCurrency,
              unit_amount: amountTotal,
              product_data: {
                name: `${serviceLabel(service)} · KLYX`,
                description: `${
                  booking.booking_date
                } · ${booking.start_time.slice(
                  0,
                  5
                )}–${booking.end_time.slice(
                  0,
                  5
                )}`,
              },
            },
          },
        ],
        metadata: {
          booking_id: booking.id,
          parent_id: booking.parent_id,
          provider_id: providerId,
          service_id: service.id,
          service_slug: service.slug,
          user_service_id: userServiceId,
          payment_mode: paymentMode,
        },
        payment_intent_data:
          paymentIntentData,
      };

    let attemptToken = randomUUID();
    let claim = await claimBookingPayment(
      booking.id,
      profile.id,
      attemptToken
    );

    if (claim.action === "paid") {
      return NextResponse.json(
        {
          error: "Cette réservation est déjà payée.",
          alreadyPaid: true,
        },
        { status: 409 }
      );
    }

    if (claim.action === "busy") {
      return NextResponse.json(
        {
          error: "Le paiement est déjà en cours de préparation. Réessaie dans quelques secondes.",
          paymentPending: true,
        },
        { status: 409 }
      );
    }

    if (claim.action === "reuse" && claim.checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        claim.checkout_session_id
      );

      if (existingSession.payment_status === "paid") {
        await markBookingPaidFromSession(existingSession);

        return NextResponse.json(
          {
            error: "Cette réservation est déjà payée.",
            alreadyPaid: true,
          },
          { status: 409 }
        );
      }

      if (existingSession.status === "open" && existingSession.url) {
        logServerInfo({
          event:
            "stripe_checkout_reused",
          route:
            "/api/stripe/create-checkout-session",
          method: "POST",
          status: 200,
          code:
            paymentMode,
          durationMs:
            Date.now() -
            startedAt,
        });

        return NextResponse.json({
          url: existingSession.url,
          reused: true,
          paymentMode,
          amountTotal,
          serviceSlug: service.slug,
        });
      }

      if (existingSession.status !== "expired") {
        return NextResponse.json(
          {
            error: "Stripe traite déjà ce paiement. Son statut sera actualisé automatiquement.",
            paymentPending: true,
          },
          { status: 409 }
        );
      }

      await releaseExpiredCheckout(booking.id, existingSession.id);
      attemptToken = randomUUID();
      claim = await claimBookingPayment(
        booking.id,
        profile.id,
        attemptToken
      );
    }

    if (claim.action !== "create") {
      return NextResponse.json(
        {
          error:
            claim.action === "paid"
              ? "Cette réservation est déjà payée."
              : "Le paiement est déjà en cours. Réessaie dans quelques secondes.",
          alreadyPaid: claim.action === "paid",
          paymentPending: claim.action !== "paid",
        },
        { status: 409 }
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `klyx-booking-${booking.id}-attempt-${claim.attempt_number}`,
    });

    if (!session.url) {
      throw new Error("Stripe n'a pas renvoyé de lien de paiement.");
    }

    const providerAmount =
      paymentMode === "connect_destination"
        ? amountTotal - applicationFeeAmount
        : null;

    const platformFeeAmount =
      paymentMode === "connect_destination"
        ? applicationFeeAmount
        : 0;

    const { data: updatedBooking, error: updateError } =
      await supabaseAdmin
        .from("bookings")
        .update({
          provider_id: providerId,
          service_id: service.id,
          user_service_id: userServiceId,
          payment_status: "checkout_created",
          stripe_checkout_session_id:
            session.id,
          amount_total: amountTotal,
          payment_mode: paymentMode,
          application_fee_amount:
            platformFeeAmount,
          platform_fee_amount:
            platformFeeAmount,
          provider_amount: providerAmount,
          payment_attempt_token: null,
          payment_checkout_started_at: null,
        })
        .eq("id", booking.id)
        .eq("payment_attempt_token", attemptToken)
        .select("id")
        .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updatedBooking) {
      const latestBooking = await getBooking(booking.id);

      if (latestBooking.payment_status === "paid") {
        return NextResponse.json(
          {
            error: "Cette réservation est déjà payée.",
            alreadyPaid: true,
          },
          { status: 409 }
        );
      }

      if (latestBooking.stripe_checkout_session_id !== session.id) {
        throw new Error("Le verrou de paiement a changé. Aucun nouveau débit n'a été lancé.");
      }
    }

    logServerInfo({
      event:
        "stripe_checkout_created",
      route:
        "/api/stripe/create-checkout-session",
      method: "POST",
      status: 200,
      code:
        paymentMode,
      durationMs:
        Date.now() -
        startedAt,
    });

    return NextResponse.json({
      url: session.url,
      reused: false,
      paymentMode,
      amountTotal,
      serviceSlug: service.slug,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de créer le paiement.";

    const status =
      message === "Réservation introuvable."
        ? 404
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event:
        "stripe_checkout_failed",
      route:
        "/api/stripe/create-checkout-session",
      method: "POST",
      status,
      code:
        "stripe_checkout_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}