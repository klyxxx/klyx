import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { apiErrorStatus, getAuthenticatedProfile, requireAccountType } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { canReceiveSettlementForBooking } from "@/lib/economic-settlement-eligibility-server";
import {
  assertFinancialStripeWriteAuthorized,
  assertStripeObjectMode,
  getFinancialStripeRuntime,
  getProviderFinancialDestination,
} from "@/lib/financial-stripe-runtime";
import { calculateKlyxEconomics, getKlyxCommissionPercent } from "@/lib/klyx-economics";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import { logServerInfo, logServerWarning } from "@/lib/server-log";
import {
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";
import { markBookingPaidFromSession } from "@/lib/stripe-payments";
import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";
import {
  buildPlatformHeldPaymentIntentPlan,
  getKlyxSettlementMode,
  KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
} from "@/lib/stripe-settlement-control";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  estimated_amount_cents: number | null;
  amount_total: number | null;
  stripe_checkout_session_id: string | null;
};

type PaymentClaimRow = {
  action: "create" | "reuse" | "busy" | "paid";
  checkout_session_id: string | null;
  attempt_number: number;
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


function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function serviceLabel(service: ServiceRow): string {
  return service.name?.trim() || service.slug || "Service KLYX";
}

async function getBooking(bookingId: string): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, booking_group_id, service_id, user_service_id, booking_date, start_time, end_time, status, payment_status, currency, estimated_amount_cents, amount_total, stripe_checkout_session_id"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Réservation introuvable.");
  return data as BookingRow;
}

async function claimBookingPayment(
  bookingId: string,
  clientProfileId: string,
  attemptToken: string
): Promise<PaymentClaimRow> {
  const { data, error } = await supabaseAdmin.rpc("klyx_claim_booking_payment", {
    p_booking_id: bookingId,
    p_client_profile_id: clientProfileId,
    p_attempt_token: attemptToken,
  });

  if (error) throw new Error(error.message);
  const claim = ((data ?? []) as PaymentClaimRow[])[0];
  if (!claim) throw new Error("Impossible de verrouiller le paiement.");
  return claim;
}

async function releaseExpiredCheckout(bookingId: string, checkoutSessionId: string) {
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

async function expireOpenSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.status === "open") {
    await stripe.checkout.sessions.expire(session.id);
  }
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

  if (serviceError) throw new Error(serviceError.message);
  if (userServiceError) throw new Error(userServiceError.message);
  if (serviceProfileError) throw new Error(serviceProfileError.message);
  if (!serviceData) throw new Error("Service introuvable.");
  if (!userServiceData) {
    throw new Error("Le métier de cette réservation ne correspond plus au prestataire.");
  }
  if (!serviceProfileData) throw new Error("Profil de service introuvable.");

  return {
    service: serviceData as ServiceRow,
    userServiceId: booking.user_service_id,
    serviceProfile: serviceProfileData as ServiceProfileRow,
  };
}

async function persistPlatformHeldCheckout(input: {
  bookingId: string;
  clientProfileId: string;
  attemptToken: string;
  checkoutSessionId: string;
  providerProfileId: string;
  serviceId: string;
  userServiceId: string;
  stripeAccountId: string;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  transferGroup: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_persist_platform_held_checkout",
    {
      p_booking_id: input.bookingId,
      p_client_profile_id: input.clientProfileId,
      p_attempt_token: input.attemptToken,
      p_checkout_session_id: input.checkoutSessionId,
      p_provider_profile_id: input.providerProfileId,
      p_service_id: input.serviceId,
      p_user_service_id: input.userServiceId,
      p_stripe_account_id: input.stripeAccountId,
      p_currency: input.currency,
      p_gross_amount_cents: input.grossAmountCents,
      p_platform_fee_cents: input.platformFeeCents,
      p_provider_amount_cents: input.providerAmountCents,
      p_transfer_group: input.transferGroup,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_PLATFORM_HELD_CHECKOUT_NOT_PERSISTED");
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    if (getKlyxSettlementMode() !== KLYX_PLATFORM_HELD_SETTLEMENT_MODE) {
      throw new Error("KLYX_PLATFORM_HELD_MODE_NOT_ACTIVE");
    }

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
          error: "KLYX n'est pas encore ouvert aux paiements dans le pays de ce profil client.",
          code: "KLYX_CHECKOUT_MARKET_NOT_READY",
          participant: "client",
        },
        { status: 409 }
      );
    }

    const financialStripe = getFinancialStripeRuntime();
    const stripe = financialStripe.stripe;
    if (financialStripe.mode !== stripeRuntime.mode) {
      throw new Error("KLYX_FINANCIAL_STRIPE_MODE_MISMATCH");
    }
    const body = (await request.json()) as { bookingId?: string };
    const bookingId = body.bookingId?.trim();

    if (!bookingId) {
      logServerWarning({
        event: "stripe_platform_held_checkout_rejected",
        route: "/api/stripe/create-checkout-session",
        method: "POST",
        status: 400,
        code: "booking_required",
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ error: "Réservation manquante." }, { status: 400 });
    }

    const booking = await getBooking(bookingId);

    if (booking.parent_id !== profile.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    if (booking.booking_group_id) {
      return NextResponse.json(
        {
          error: "Platform-held n'est pas encore certifié pour les réservations groupées.",
          code: "KLYX_PLATFORM_HELD_GROUP_NOT_SUPPORTED",
        },
        { status: 409 }
      );
    }

    const { data: splitPaymentUnits, error: splitPaymentGuardError } =
      await supabaseAdmin
        .from("split_booking_payment_units")
        .select("id")
        .filter("booking_ids", "cs", JSON.stringify([booking.id]))
        .limit(1);

    if (splitPaymentGuardError) throw new Error(splitPaymentGuardError.message);

    if ((splitPaymentUnits ?? []).length > 0) {
      return NextResponse.json(
        {
          error: "Platform-held n'est pas encore certifié pour les missions multi-prestataires.",
          code: "KLYX_PLATFORM_HELD_SPLIT_NOT_SUPPORTED",
        },
        { status: 409 }
      );
    }

    if (booking.status !== "accepted") {
      return NextResponse.json(
        { error: "La réservation doit être acceptée avant le paiement." },
        { status: 400 }
      );
    }

    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { error: "Cette réservation est déjà payée.", alreadyPaid: true },
        { status: 409 }
      );
    }

    const providerId = booking.provider_id ?? booking.babysitter_id;
    if (!providerId) throw new Error("Prestataire introuvable.");

    const provider = await getProviderFinancialDestination(
      providerId,
      stripeRuntime.mode
    );
    const providerMarketAccess = assessKlyxStripeMarketAccess(
      provider.countryCode ?? "",
      stripeRuntime.mode
    );

    if (!providerMarketAccess.allowed) {
      return NextResponse.json(
        {
          error: "KLYX n'est pas encore ouvert aux paiements dans le pays de ce prestataire.",
          code: "KLYX_CHECKOUT_MARKET_NOT_READY",
          participant: "provider",
        },
        { status: 409 }
      );
    }

    const canonicalStripeAccountId = provider.connect.stripeAccountId;
    if (!canonicalStripeAccountId) {
      return NextResponse.json(
        {
          error: "Le prestataire doit disposer d'un compte Stripe Connect vérifié.",
          code: "KLYX_PLATFORM_HELD_PROVIDER_STRIPE_REQUIRED",
        },
        { status: 409 }
      );
    }

    const providerStripeAccount = await stripe.accounts.retrieve(
      canonicalStripeAccountId
    );
    const countryAssessment = assessStripeConnectCountry({
      klyxCountryCode: provider.countryCode,
      stripeCountryCode: providerStripeAccount.country,
    });

    if (!countryAssessment.matches) {
      return NextResponse.json(
        {
          error: "Le pays du compte de paiement du prestataire ne correspond plus à son pays KLYX.",
          code: STRIPE_ACCOUNT_COUNTRY_MISMATCH,
        },
        { status: 409 }
      );
    }

    const providerRecipientAccount = await stripe.v2.core.accounts.retrieve(
      canonicalStripeAccountId,
      { include: ["configuration.recipient", "identity", "requirements"] }
    );
    const providerReady = Boolean(
      providerRecipientAccount.livemode === financialStripe.livemode &&
        providerRecipientAccount.identity?.country?.toUpperCase() ===
          provider.countryCode?.toUpperCase() &&
        providerRecipientAccount.applied_configurations?.includes("recipient") === true &&
        providerRecipientAccount.configuration?.recipient?.applied === true &&
        providerRecipientAccount.configuration?.recipient?.capabilities?.stripe_balance
          ?.stripe_transfers?.status === "active"
    );

    if (!providerReady) {
      return NextResponse.json(
        {
          error: "Le prestataire doit terminer la vérification Stripe avant ce paiement.",
          code: "KLYX_PLATFORM_HELD_PROVIDER_NOT_READY",
        },
        { status: 409 }
      );
    }

    const economicEligibility = await canReceiveSettlementForBooking({
      accountId: provider.accountId,
      bookingId: booking.id,
      expectedProviderProfileId: providerId,
      expectedStripeAccountId: canonicalStripeAccountId,
    });

    if (!economicEligibility || economicEligibility.decision !== "allowed") {
      return NextResponse.json(
        {
          error:
            "Le prestataire n'est pas économiquement éligible à recevoir ce settlement.",
          code: "KLYX_ECONOMIC_SETTLEMENT_ELIGIBILITY_REQUIRED",
          decision: economicEligibility?.decision ?? "human_review",
          reasonCodes: economicEligibility?.reasonCodes ?? [
            "economic_settlement_context_missing",
          ],
        },
        { status: 409 }
      );
    }

    const { service, userServiceId, serviceProfile } = await resolveService(
      booking,
      providerId
    );

    if (serviceProfile.price == null) {
      throw new Error("Prix du service non renseigné.");
    }

    const durationMinutes =
      timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time);
    if (durationMinutes <= 0) {
      return NextResponse.json({ error: "Durée de réservation invalide." }, { status: 400 });
    }

    const fallbackAmount = Math.round(
      Number(serviceProfile.price) *
        (serviceProfile.pricing_type === "fixed" ? 1 : durationMinutes / 60) *
        100
    );
    const amountTotal =
      booking.estimated_amount_cents ?? booking.amount_total ?? fallbackAmount;

    if (amountTotal < 50) throw new Error("Le montant calculé est trop faible.");

    const checkoutCurrency = booking.currency?.trim().toLowerCase() ?? "";
    if (!/^[a-z]{3}$/.test(checkoutCurrency)) {
      throw new Error("Devise de réservation invalide.");
    }

    const economics = calculateKlyxEconomics(
      amountTotal,
      getKlyxCommissionPercent()
    );
    if (stripeRuntime.mode === "live") {
      await assertFinancialStripeWriteAuthorized({
        capability: "payments",
        countryCode: profile.countryCode,
        currency: checkoutCurrency.toUpperCase(),
      });
    }

    const plan = buildPlatformHeldPaymentIntentPlan({
      subjectType: "booking",
      subjectId: booking.id,
      providerProfileId: providerId,
      providerStripeAccountId: canonicalStripeAccountId,
      metadata: {
        booking_id: booking.id,
        provider_id: providerId,
        service_id: service.id,
        service_slug: service.slug,
        user_service_id: userServiceId,
      },
    });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.headers.get("origin") ||
      "http://localhost:3000";

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
              description: `${booking.booking_date} · ${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`,
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
        payment_mode: plan.paymentMode,
        settlement_transfer_group: plan.transferGroup,
      },
      payment_intent_data: {
        metadata: plan.metadata,
        transfer_group: plan.transferGroup,
      },
    };

    let attemptToken = randomUUID();
    let claim = await claimBookingPayment(booking.id, profile.id, attemptToken);

    if (claim.action === "paid") {
      return NextResponse.json(
        { error: "Cette réservation est déjà payée.", alreadyPaid: true },
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
      assertStripeObjectMode(existingSession.livemode, financialStripe);

      if (existingSession.payment_status === "paid") {
        await markBookingPaidFromSession(existingSession);
        return NextResponse.json(
          { error: "Cette réservation est déjà payée.", alreadyPaid: true },
          { status: 409 }
        );
      }

      const sameHeldMode =
        existingSession.metadata?.payment_mode === KLYX_PLATFORM_HELD_SETTLEMENT_MODE;

      if (sameHeldMode && existingSession.status === "open" && existingSession.url) {
        return NextResponse.json({
          url: existingSession.url,
          reused: true,
          paymentMode: plan.paymentMode,
          amountTotal,
          serviceSlug: service.slug,
        });
      }

      if (existingSession.status === "open" && !sameHeldMode) {
        await stripe.checkout.sessions.expire(existingSession.id);
      }

      if (existingSession.status === "expired" || !sameHeldMode) {
        await releaseExpiredCheckout(booking.id, existingSession.id);
        attemptToken = randomUUID();
        claim = await claimBookingPayment(booking.id, profile.id, attemptToken);
      } else {
        return NextResponse.json(
          {
            error: "Stripe traite déjà ce paiement. Son statut sera actualisé automatiquement.",
            paymentPending: true,
          },
          { status: 409 }
        );
      }
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

    if (stripeRuntime.mode === "live") {
      await assertFinancialStripeWriteAuthorized({
        capability: "payments",
        countryCode: profile.countryCode,
        currency: checkoutCurrency.toUpperCase(),
      });
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `klyx-booking-held-${booking.id}-attempt-${claim.attempt_number}`,
    });

    assertStripeObjectMode(session.livemode, financialStripe);

    if (!session.url) {
      await expireOpenSession(stripe, session);
      throw new Error("Stripe n'a pas renvoyé de lien de paiement.");
    }

    try {
      await persistPlatformHeldCheckout({
        bookingId: booking.id,
        clientProfileId: profile.id,
        attemptToken,
        checkoutSessionId: session.id,
        providerProfileId: providerId,
        serviceId: service.id,
        userServiceId,
        stripeAccountId: canonicalStripeAccountId,
        currency: checkoutCurrency.toUpperCase(),
        grossAmountCents: economics.grossAmountCents,
        platformFeeCents: economics.platformFeeCents,
        providerAmountCents: economics.providerAmountCents,
        transferGroup: plan.transferGroup,
      });
    } catch (error) {
      await expireOpenSession(stripe, session);
      throw error;
    }

    logServerInfo({
      event: "stripe_platform_held_checkout_created",
      route: "/api/stripe/create-checkout-session",
      method: "POST",
      status: 200,
      code: plan.paymentMode,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      url: session.url,
      reused: false,
      paymentMode: plan.paymentMode,
      amountTotal,
      serviceSlug: service.slug,
    });
  } catch (error) {
    if (isStripeConnectIdentityReviewRequired(error)) {
      return NextResponse.json(
        {
          error: "L'identité Stripe Connect du prestataire nécessite une revue avant paiement.",
          code: "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED",
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Impossible de créer le paiement.";
    const status = message === "Réservation introuvable." ? 404 : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "stripe_platform_held_checkout_failed",
      route: "/api/stripe/create-checkout-session",
      method: "POST",
      status,
      code: "stripe_platform_held_checkout_failed",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}