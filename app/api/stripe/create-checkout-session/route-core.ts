import { NextResponse } from "next/server";
import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { markBookingPaidFromSession } from "@/lib/stripe-payments";
import { calculateKlyxEconomics, getKlyxCommissionPercent } from "@/lib/klyx-economics";
import { calculateKlyxMarketEconomics } from "@/lib/klyx-market-policy";
import { resolveKlyxMarketPaymentPolicy } from "@/lib/klyx-market-policy-server";
import { toKlyxStripeChargeAmount } from "@/lib/klyx-currency";
import { toKlyxMinorUnits } from "@/lib/klyx-money";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";
import {
  assertStripeConnectIdentityUsable,
  getProfileAccountStripeConnectIdentity,
  STRIPE_CONNECT_IDENTITY_CONFLICT,
} from "@/lib/stripe-connect-account-identity";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { logServerInfo, logServerWarning } from "@/lib/server-log";
import { secureApiErrorResponse } from "@/lib/api-error";

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
  payer_country_code: string | null;
  execution_country_code: string | null;
  presentment_currency: string | null;
  subtotal_amount_minor: number | null;
  tax_amount_minor: number | null;
  commission_bps: number | null;
  commission_amount_minor: number | null;
  total_amount_minor: number | null;
  provider_amount_minor: number | null;
  market_payment_rule_id: string | null;
  fx_quote_id: string | null;
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
};

type ServiceRow = { id: string; slug: string; name: string | null };
type ServiceProfileRow = { price: number | null; pricing_type: string | null };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable manquante : ${name}`);
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
    { p_booking_id: bookingId, p_checkout_session_id: checkoutSessionId }
  );
  if (error) throw new Error(error.message);
  return data === true;
}

async function expireUnpersistedCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.status !== "open") return;
  await stripe.checkout.sessions.expire(session.id);
}

async function getBooking(bookingId: string): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, booking_group_id, service_id, user_service_id, booking_date, start_time, end_time, status, payment_status, currency, payer_country_code, execution_country_code, presentment_currency, subtotal_amount_minor, tax_amount_minor, commission_bps, commission_amount_minor, total_amount_minor, provider_amount_minor, market_payment_rule_id, fx_quote_id, pricing_type_snapshot, unit_price_cents, estimated_amount_cents, amount_total, stripe_checkout_session_id"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Réservation introuvable.");
  return data as BookingRow;
}

async function resolveService(booking: BookingRow, providerId: string): Promise<{
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
    supabaseAdmin.from("services").select("id, slug, name").eq("id", booking.service_id).maybeSingle(),
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

export async function POST(request: Request) {
  // KLYX_SERVER_OBSERVABILITY_12B_8B
  const startedAt = Date.now();

  try {
    const { user, profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const stripeRuntime = assertStripeRuntimeReady();

    const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
    const stripe = new Stripe(stripeSecretKey);
    const body = (await request.json()) as { bookingId?: string };
    const bookingId = body.bookingId?.trim();

    if (!bookingId) {
      logServerWarning({
        event: "stripe_checkout_rejected",
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
          error:
            "Cette reservation appartient a un groupe. Utilise le paiement groupe KLYX.",
          code: "GROUP_PAYMENT_REQUIRED",
          groupId: booking.booking_group_id,
        },
        { status: 409 }
      );
    }

    // KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27
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
          error:
            "Le paiement de cette réservation est géré par sa mission multi-prestataires.",
          splitMissionPayment: true,
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

    const { data: providerData, error: providerError } = await supabaseAdmin
      .from("profiles")
      .select("country_code")
      .eq("id", providerId)
      .maybeSingle();
    if (providerError) throw new Error(providerError.message);
    const provider = (providerData as ProviderRow | null) ?? null;

    const providerIdentity = await getProfileAccountStripeConnectIdentity(providerId);
    if (providerIdentity.state === "conflict") {
      return NextResponse.json(
        {
          error:
            "L'identité Stripe du compte KLYX du prestataire nécessite une revue avant paiement.",
          code: STRIPE_CONNECT_IDENTITY_CONFLICT,
        },
        { status: 409 }
      );
    }
    const providerStripeAccountId = assertStripeConnectIdentityUsable(providerIdentity);
    let providerStripeAccount: Stripe.Account | null = null;

    if (providerStripeAccountId) {
      providerStripeAccount = await stripe.accounts.retrieve(providerStripeAccountId);
      const countryAssessment = assessStripeConnectCountry({
        klyxCountryCode: provider?.country_code,
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

    const { service, userServiceId, serviceProfile } = await resolveService(
      booking,
      providerId
    );
    if (serviceProfile.price == null) throw new Error("Prix du service non renseigné.");

    const durationMinutes = timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time);
    if (durationMinutes <= 0) {
      return NextResponse.json({ error: "Durée de réservation invalide." }, { status: 400 });
    }

    const presentmentCurrency =
      (booking.presentment_currency ?? booking.currency)
        ?.trim()
        .toUpperCase() ?? "";
    if (!/^[A-Z]{3}$/.test(presentmentCurrency)) {
      throw new Error("Devise de réservation invalide.");
    }

    const payerCountryCode =
      booking.payer_country_code ??
      profile.countryCode ??
      "";
    const executionCountryCode =
      booking.execution_country_code ??
      provider?.country_code ??
      "";

    if (
      stripeRuntime.mode === "live" &&
      (
        !booking.payer_country_code ||
        !booking.execution_country_code ||
        !booking.presentment_currency ||
        booking.subtotal_amount_minor == null
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Cette réservation ne possède pas encore le snapshot monétaire global requis pour un paiement LIVE.",
          code: "KLYX_GLOBAL_MONEY_SNAPSHOT_REQUIRED",
        },
        { status: 409 }
      );
    }

    const legacyFallbackAmount =
      toKlyxMinorUnits(
        Number(serviceProfile.price) *
          (serviceProfile.pricing_type === "fixed"
            ? 1
            : durationMinutes / 60),
        executionCountryCode || payerCountryCode,
        presentmentCurrency
      );

    const subtotalAmountMinor =
      booking.subtotal_amount_minor ??
      booking.estimated_amount_cents ??
      booking.amount_total ??
      legacyFallbackAmount;

    if (
      !Number.isSafeInteger(subtotalAmountMinor) ||
      subtotalAmountMinor <= 0
    ) {
      throw new Error("Montant calculé invalide.");
    }

    let resolvedPolicy:
      Awaited<ReturnType<typeof resolveKlyxMarketPaymentPolicy>> | null =
      null;

    try {
      resolvedPolicy =
        await resolveKlyxMarketPaymentPolicy({
          payerCountryCode,
          executionCountryCode,
          serviceSlug: service.slug,
          currencyCode: presentmentCurrency,
        });
    } catch (policyError) {
      if (stripeRuntime.mode === "live") {
        throw policyError;
      }

      logServerWarning({
        event: "global_market_policy_test_fallback",
        route: "/api/stripe/create-checkout-session",
        method: "POST",
        status: 200,
        code: "test_only_legacy_fallback",
        durationMs: Date.now() - startedAt,
      });
    }

    if (
      resolvedPolicy &&
      (
        resolvedPolicy.rule ||
        resolvedPolicy.currencyCapability
      ) &&
      !resolvedPolicy.assessment.allowed
    ) {
      return NextResponse.json(
        {
          error:
            "La combinaison pays payeur, pays d’exécution et devise n’est pas autorisée pour ce paiement.",
          code: "KLYX_CHECKOUT_MARKET_NOT_READY",
          payerCountryCode,
          executionCountryCode,
          currency: presentmentCurrency,
          blockers: resolvedPolicy.assessment.blockers,
        },
        { status: 409 }
      );
    }

    if (
      stripeRuntime.mode === "live" &&
      (
        !resolvedPolicy ||
        !resolvedPolicy.rule ||
        !resolvedPolicy.currencyCapability ||
        !resolvedPolicy.assessment.allowed
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Aucune règle financière LIVE certifiée ne couvre ce marché et cette devise.",
          code: "KLYX_CHECKOUT_MARKET_NOT_READY",
          payerCountryCode,
          executionCountryCode,
          currency: presentmentCurrency,
          blockers:
            resolvedPolicy?.assessment.blockers ?? [
              "market_rule",
              "stripe_currency_capability",
            ],
        },
        { status: 409 }
      );
    }

    let taxAmountMinor = 0;
    let commissionAmountMinor = 0;
    let commissionBps = Math.round(
      getKlyxCommissionPercent() * 100
    );
    let totalAmountMinor = subtotalAmountMinor;
    let providerAmountMinor = subtotalAmountMinor;
    let marketPaymentRuleId: string | null = null;

    if (
      resolvedPolicy?.rule &&
      resolvedPolicy.currencyCapability &&
      resolvedPolicy.assessment.allowed
    ) {
      const marketEconomics =
        calculateKlyxMarketEconomics({
          subtotalMinor: subtotalAmountMinor,
          commissionBps:
            resolvedPolicy.rule.commissionBps,
          taxMode:
            resolvedPolicy.rule.taxMode,
          taxRateBps:
            resolvedPolicy.rule.taxRateBps,
          taxInclusive:
            resolvedPolicy.rule.taxInclusive,
          taxLiability:
            resolvedPolicy.rule.taxLiability,
        });

      taxAmountMinor = marketEconomics.taxMinor;
      commissionAmountMinor =
        marketEconomics.commissionMinor;
      commissionBps =
        resolvedPolicy.rule.commissionBps;
      totalAmountMinor =
        marketEconomics.totalMinor;
      providerAmountMinor =
        marketEconomics.providerAmountMinor;
      marketPaymentRuleId =
        resolvedPolicy.rule.id;
    } else {
      // TEST-only compatibility while existing fixtures migrate to explicit
      // market policy rows. This path is unreachable in LIVE mode.
      const legacyEconomics =
        calculateKlyxEconomics(
          subtotalAmountMinor,
          getKlyxCommissionPercent()
        );

      commissionAmountMinor =
        legacyEconomics.platformFeeCents;
      providerAmountMinor =
        legacyEconomics.providerAmountCents;
    }

    const checkoutCurrency =
      presentmentCurrency.toLowerCase();
    const amountTotal =
      toKlyxStripeChargeAmount(
        totalAmountMinor,
        presentmentCurrency
      );
    const applicationFeeAmount =
      toKlyxStripeChargeAmount(
        commissionAmountMinor +
          (
            resolvedPolicy?.rule?.taxLiability === "platform"
              ? taxAmountMinor
              : 0
          ),
        presentmentCurrency
      );

    const capability =
      resolvedPolicy?.currencyCapability ?? null;

    if (
      capability?.minimumChargeAmount != null &&
      amountTotal < capability.minimumChargeAmount
    ) {
      throw new Error("KLYX_STRIPE_CHARGE_BELOW_CURRENCY_MINIMUM");
    }

    if (
      capability?.maximumChargeAmount != null &&
      amountTotal > capability.maximumChargeAmount
    ) {
      throw new Error("KLYX_STRIPE_CHARGE_ABOVE_CURRENCY_MAXIMUM");
    }
    const providerReady = Boolean(
      providerStripeAccountId &&
        providerStripeAccount?.details_submitted &&
        providerStripeAccount.charges_enabled &&
        providerStripeAccount.payouts_enabled
    );
    const platformOnlyTestAllowed =
      stripeSecretKey.startsWith("sk_test_") &&
      envIsTrue("KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS");

    if (!providerReady && !platformOnlyTestAllowed) {
      return NextResponse.json(
        {
          error:
            "Le prestataire doit terminer la vérification Stripe avant de recevoir un paiement.",
        },
        { status: 400 }
      );
    }

    const paymentMode = providerReady ? "connect_destination" : "platform_test_only";
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      metadata: {
        booking_id: booking.id,
        provider_id: providerId,
        provider_account_id: providerIdentity.accountId,
        service_id: service.id,
        service_slug: service.slug,
        user_service_id: userServiceId,
        payment_mode: paymentMode,
        payer_country_code: payerCountryCode,
        execution_country_code: executionCountryCode,
        presentment_currency: presentmentCurrency,
        market_payment_rule_id: marketPaymentRuleId ?? "",
      },
    };

    if (providerReady && providerStripeAccountId) {
      paymentIntentData.application_fee_amount = applicationFeeAmount;
      paymentIntentData.transfer_data = { destination: providerStripeAccountId };
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
              description: `${booking.booking_date} · ${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`,
            },
          },
        },
      ],
      metadata: {
        booking_id: booking.id,
        parent_id: booking.parent_id,
        provider_id: providerId,
        provider_account_id: providerIdentity.accountId,
        service_id: service.id,
        service_slug: service.slug,
        user_service_id: userServiceId,
        payment_mode: paymentMode,
        payer_country_code: payerCountryCode,
        execution_country_code: executionCountryCode,
        presentment_currency: presentmentCurrency,
        market_payment_rule_id: marketPaymentRuleId ?? "",
      },
      payment_intent_data: paymentIntentData,
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
          error:
            "Le paiement est déjà en cours de préparation. Réessaie dans quelques secondes.",
          paymentPending: true,
        },
        { status: 409 }
      );
    }

    if (claim.action === "reuse" && claim.checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(claim.checkout_session_id);
      if (existingSession.payment_status === "paid") {
        await markBookingPaidFromSession(existingSession);
        return NextResponse.json(
          { error: "Cette réservation est déjà payée.", alreadyPaid: true },
          { status: 409 }
        );
      }
      if (existingSession.status === "open" && existingSession.url) {
        logServerInfo({
          event: "stripe_checkout_reused",
          route: "/api/stripe/create-checkout-session",
          method: "POST",
          status: 200,
          code: paymentMode,
          durationMs: Date.now() - startedAt,
        });
        return NextResponse.json({
          url: existingSession.url,
          reused: true,
          paymentMode,
          amountTotal,
          amountTotalMinor: totalAmountMinor,
          presentmentCurrency,
          serviceSlug: service.slug,
        });
      }
      if (existingSession.status !== "expired") {
        return NextResponse.json(
          {
            error:
              "Stripe traite déjà ce paiement. Son statut sera actualisé automatiquement.",
            paymentPending: true,
          },
          { status: 409 }
        );
      }
      await releaseExpiredCheckout(booking.id, existingSession.id);
      attemptToken = randomUUID();
      claim = await claimBookingPayment(booking.id, profile.id, attemptToken);
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
      await expireUnpersistedCheckoutSession(stripe, session);
      throw new Error("Stripe n'a pas renvoyé de lien de paiement.");
    }

    const providerAmount =
      paymentMode === "connect_destination" ? amountTotal - applicationFeeAmount : null;
    const platformFeeAmount =
      paymentMode === "connect_destination" ? applicationFeeAmount : 0;

    try {
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({
          provider_id: providerId,
          service_id: service.id,
          user_service_id: userServiceId,
          payment_status: "checkout_created",
          stripe_checkout_session_id: session.id,
          amount_total: amountTotal,
          payment_mode: paymentMode,
          application_fee_amount: platformFeeAmount,
          platform_fee_amount: platformFeeAmount,
          provider_amount: providerAmount,
          payer_country_code: payerCountryCode,
          execution_country_code: executionCountryCode,
          presentment_currency: presentmentCurrency,
          subtotal_amount_minor: subtotalAmountMinor,
          tax_amount_minor: taxAmountMinor,
          tax_mode: resolvedPolicy?.rule?.taxMode ?? "none",
          tax_rate_bps: resolvedPolicy?.rule?.taxRateBps ?? 0,
          tax_inclusive: resolvedPolicy?.rule?.taxInclusive ?? false,
          tax_liability: resolvedPolicy?.rule?.taxLiability ?? "provider",
          stripe_tax_code: resolvedPolicy?.rule?.stripeTaxCode ?? null,
          commission_bps: commissionBps,
          commission_amount_minor: commissionAmountMinor,
          total_amount_minor: totalAmountMinor,
          provider_amount_minor: providerAmountMinor,
          market_payment_rule_id: marketPaymentRuleId,
          payment_attempt_token: null,
          payment_checkout_started_at: null,
        })
        .eq("id", booking.id)
        .eq("payment_attempt_token", attemptToken)
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      if (!updatedBooking) {
        const latestBooking = await getBooking(booking.id);
        if (latestBooking.payment_status === "paid") {
          await expireUnpersistedCheckoutSession(stripe, session);
          return NextResponse.json(
            { error: "Cette réservation est déjà payée.", alreadyPaid: true },
            { status: 409 }
          );
        }
        if (latestBooking.stripe_checkout_session_id !== session.id) {
          throw new Error(
            "Le verrou de paiement a changé. Aucun nouveau débit n'a été lancé."
          );
        }
      }
    } catch (error) {
      await expireUnpersistedCheckoutSession(stripe, session);
      throw error;
    }

    logServerInfo({
      event: "stripe_checkout_created",
      route: "/api/stripe/create-checkout-session",
      method: "POST",
      status: 200,
      code: paymentMode,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      url: session.url,
      reused: false,
      paymentMode,
      amountTotal,
      amountTotalMinor: totalAmountMinor,
      presentmentCurrency,
      serviceSlug: service.slug,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer le paiement.";
    const status = message === "Réservation introuvable." ? 404 : apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "stripe_checkout_failed",
      route: "/api/stripe/create-checkout-session",
      method: "POST",
      status,
      code: "stripe_checkout_failed",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}