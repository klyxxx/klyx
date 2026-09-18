import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { apiErrorStatus, getAuthenticatedProfile, requireAccountType } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { calculateKlyxEconomics, getKlyxCommissionPercent } from "@/lib/klyx-economics";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import { logServerInfo, logServerWarning } from "@/lib/server-log";
import {
  getProviderStripeDestination,
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";
import { markBookingGroupPaidFromSession } from "@/lib/stripe-group-payments";
import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";
import {
  buildPlatformHeldPaymentIntentPlan,
  getKlyxSettlementMode,
  KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
} from "@/lib/stripe-settlement-control";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ClaimRow = {
  action: "create" | "reuse" | "busy" | "paid";
  checkout_session_id: string | null;
  attempt_number: number;
};

function requiredTestStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
  if (!key.startsWith("sk_test_")) throw new Error("KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED");
  return key;
}

async function claim(groupId: string, clientId: string, token: string): Promise<ClaimRow> {
  const { data, error } = await supabaseAdmin.rpc("klyx_claim_booking_group_payment", {
    p_group_id: groupId,
    p_client_profile_id: clientId,
    p_attempt_token: token,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ClaimRow[])[0];
  if (!row) throw new Error("Verrou paiement groupe impossible.");
  return row;
}

async function releaseExpiredCheckout(groupId: string, checkoutSessionId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_release_expired_booking_group_checkout",
    { p_group_id: groupId, p_checkout_session_id: checkoutSessionId }
  );
  if (error) throw new Error(error.message);
  return data === true;
}

async function expireOpenSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
}

async function persistPlatformHeldGroupCheckout(input: {
  groupId: string;
  clientProfileId: string;
  attemptToken: string;
  checkoutSessionId: string;
  providerProfileId: string;
  stripeAccountId: string;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  transferGroup: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_persist_platform_held_group_checkout",
    {
      p_group_id: input.groupId,
      p_client_profile_id: input.clientProfileId,
      p_attempt_token: input.attemptToken,
      p_checkout_session_id: input.checkoutSessionId,
      p_provider_profile_id: input.providerProfileId,
      p_stripe_account_id: input.stripeAccountId,
      p_currency: input.currency,
      p_gross_amount_cents: input.grossAmountCents,
      p_platform_fee_cents: input.platformFeeCents,
      p_provider_amount_cents: input.providerAmountCents,
      p_transfer_group: input.transferGroup,
    }
  );
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_PLATFORM_HELD_GROUP_CHECKOUT_NOT_PERSISTED");
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
    const clientMarketAccess = assessKlyxStripeMarketAccess(profile.countryCode, stripeRuntime.mode);
    if (!clientMarketAccess.allowed) {
      return NextResponse.json(
        {
          error: "KLYX n'est pas encore ouvert aux paiements dans le pays de ce profil client.",
          code: "KLYX_GROUP_CHECKOUT_MARKET_NOT_READY",
          participant: "client",
        },
        { status: 409 }
      );
    }

    const stripeSecretKey = requiredTestStripeKey();
    const stripe = new Stripe(stripeSecretKey);
    const body = (await request.json()) as { groupId?: string };
    const groupId = body.groupId?.trim() ?? "";

    if (!groupId) {
      return NextResponse.json({ error: "Réservation groupée manquante." }, { status: 400 });
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from("booking_groups")
      .select(
        "id, client_profile_id, provider_profile_id, user_service_id, status, payment_status, total_amount_cents, currency, stripe_checkout_session_id, cancellation_request_status"
      )
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) throw new Error(groupError.message);
    if (!group) {
      return NextResponse.json({ error: "Réservation groupée introuvable." }, { status: 404 });
    }
    if (group.client_profile_id !== profile.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
    if (group.cancellation_request_status === "requested") {
      return NextResponse.json(
        {
          error: "Une demande d'annulation est ouverte. Le paiement reste suspendu.",
          code: "GROUP_CANCELLATION_PENDING",
        },
        { status: 409 }
      );
    }
    if (group.status !== "accepted") {
      return NextResponse.json(
        { error: "Le prestataire doit accepter tous les créneaux avant le paiement." },
        { status: 409 }
      );
    }
    if (group.payment_status === "paid") {
      return NextResponse.json(
        { error: "Cette réservation groupée est déjà payée.", alreadyPaid: true },
        { status: 409 }
      );
    }

    const { data: childBookings, error: childError } = await supabaseAdmin
      .from("bookings")
      .select("id, provider_id, babysitter_id, status, amount_total, currency")
      .eq("booking_group_id", groupId)
      .order("group_position", { ascending: true });

    if (childError) throw new Error(childError.message);
    if (!childBookings || childBookings.length < 2) {
      throw new Error("Les réservations du groupe sont introuvables.");
    }
    if (childBookings.some((booking) => booking.status !== "accepted")) {
      return NextResponse.json(
        { error: "Tous les créneaux doivent être acceptés avant le paiement." },
        { status: 409 }
      );
    }
    if (
      childBookings.some(
        (booking) =>
          (booking.provider_id ?? booking.babysitter_id) !== group.provider_profile_id
      )
    ) {
      throw new Error("KLYX_GROUP_HELD_CHILD_PROVIDER_MISMATCH");
    }

    const amountTotal = Number(group.total_amount_cents);
    const childTotal = childBookings.reduce(
      (sum, booking) => sum + Number(booking.amount_total ?? 0),
      0
    );
    if (!Number.isSafeInteger(amountTotal) || amountTotal < 50 || childTotal !== amountTotal) {
      throw new Error("Le montant du groupe ne correspond pas aux réservations.");
    }

    const groupCurrency = String(group.currency ?? "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(groupCurrency)) throw new Error("Devise du groupe invalide.");
    if (
      childBookings.some(
        (booking) =>
          booking.currency &&
          String(booking.currency).trim().toUpperCase() !== groupCurrency
      )
    ) {
      throw new Error("KLYX_GROUP_HELD_CHILD_CURRENCY_MISMATCH");
    }

    const { data: userService, error: userServiceError } = await supabaseAdmin
      .from("user_services")
      .select("id, service_id, active")
      .eq("id", group.user_service_id)
      .eq("user_id", group.provider_profile_id)
      .eq("active", true)
      .maybeSingle();

    if (userServiceError) throw new Error(userServiceError.message);
    if (!userService) throw new Error("Le service du prestataire n'est plus actif.");

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, slug, name")
      .eq("id", userService.service_id)
      .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);
    if (!service) throw new Error("Service KLYX introuvable.");

    const provider = await getProviderStripeDestination(group.provider_profile_id);
    const providerMarketAccess = assessKlyxStripeMarketAccess(
      provider.countryCode ?? "",
      stripeRuntime.mode
    );
    if (!providerMarketAccess.allowed) {
      return NextResponse.json(
        {
          error: "KLYX n'est pas encore ouvert aux paiements dans le pays de ce prestataire.",
          code: "KLYX_GROUP_CHECKOUT_MARKET_NOT_READY",
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

    const legacyStripeAccount = await stripe.accounts.retrieve(canonicalStripeAccountId);
    const countryAssessment = assessStripeConnectCountry({
      klyxCountryCode: provider.countryCode,
      stripeCountryCode: legacyStripeAccount.country,
    });
    if (!countryAssessment.matches) {
      return NextResponse.json(
        {
          error: "Le pays du compte Stripe du prestataire ne correspond plus à son pays KLYX.",
          code: STRIPE_ACCOUNT_COUNTRY_MISMATCH,
        },
        { status: 409 }
      );
    }

    const recipientAccount = await stripe.v2.core.accounts.retrieve(canonicalStripeAccountId, {
      include: ["configuration.recipient", "identity", "requirements"],
    });
    const expectedCountry = String(provider.countryCode ?? "").trim().toUpperCase();
    const providerReady = Boolean(
      recipientAccount.livemode === false &&
        recipientAccount.identity?.country === expectedCountry &&
        recipientAccount.applied_configurations?.includes("recipient") === true &&
        recipientAccount.configuration?.recipient?.applied === true &&
        recipientAccount.configuration?.recipient?.capabilities?.stripe_balance
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

    const economics = calculateKlyxEconomics(amountTotal, getKlyxCommissionPercent());
    const plan = buildPlatformHeldPaymentIntentPlan({
      subjectType: "booking_group",
      subjectId: group.id,
      providerProfileId: group.provider_profile_id,
      providerStripeAccountId: canonicalStripeAccountId,
      metadata: {
        booking_group_id: group.id,
        provider_id: group.provider_profile_id,
        service_id: service.id,
        service_slug: service.slug,
        user_service_id: group.user_service_id,
      },
    });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: user.email,
      success_url:
        origin +
        "/booking-groups/" +
        group.id +
        "?payment=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/booking-groups/" + group.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: groupCurrency.toLowerCase(),
            unit_amount: amountTotal,
            product_data: {
              name: (service.name?.trim() || service.slug) + " · KLYX",
              description:
                String(childBookings.length) + " créneaux · réservation groupée",
            },
          },
        },
      ],
      metadata: {
        booking_group_id: group.id,
        provider_id: group.provider_profile_id,
        provider_account_id: provider.accountId,
        service_id: service.id,
        service_slug: service.slug,
        user_service_id: group.user_service_id,
        payment_mode: plan.paymentMode,
        settlement_transfer_group: plan.transferGroup,
      },
      payment_intent_data: {
        metadata: plan.metadata,
        transfer_group: plan.transferGroup,
      },
    };

    let attemptToken = randomUUID();
    let paymentClaim = await claim(group.id, profile.id, attemptToken);

    if (paymentClaim.action === "paid") {
      return NextResponse.json(
        { error: "Cette réservation groupée est déjà payée.", alreadyPaid: true },
        { status: 409 }
      );
    }
    if (paymentClaim.action === "busy") {
      return NextResponse.json(
        {
          error: "Le paiement groupé est déjà en cours de préparation.",
          paymentPending: true,
        },
        { status: 409 }
      );
    }

    if (paymentClaim.action === "reuse" && paymentClaim.checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        paymentClaim.checkout_session_id
      );

      if (existing.payment_status === "paid") {
        await markBookingGroupPaidFromSession(existing);
        return NextResponse.json(
          { error: "Cette réservation groupée est déjà payée.", alreadyPaid: true },
          { status: 409 }
        );
      }

      const sameHeldMode =
        existing.metadata?.payment_mode === KLYX_PLATFORM_HELD_SETTLEMENT_MODE;

      if (sameHeldMode && existing.status === "open" && existing.url) {
        return NextResponse.json({
          url: existing.url,
          reused: true,
          paymentMode: plan.paymentMode,
          amountTotal,
          groupId: group.id,
        });
      }

      if (existing.status === "open" && !sameHeldMode) {
        await stripe.checkout.sessions.expire(existing.id);
      }

      if (existing.status === "expired" || !sameHeldMode) {
        await releaseExpiredCheckout(group.id, existing.id);
        attemptToken = randomUUID();
        paymentClaim = await claim(group.id, profile.id, attemptToken);
      } else {
        return NextResponse.json(
          {
            error: "Stripe traite déjà ce paiement groupé.",
            paymentPending: true,
          },
          { status: 409 }
        );
      }
    }

    if (paymentClaim.action !== "create") {
      return NextResponse.json(
        {
          error:
            paymentClaim.action === "paid"
              ? "Cette réservation groupée est déjà payée."
              : "Le paiement groupé est déjà en cours.",
          alreadyPaid: paymentClaim.action === "paid",
          paymentPending: paymentClaim.action !== "paid",
        },
        { status: 409 }
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey:
        "klyx-booking-group-held-" +
        group.id +
        "-attempt-" +
        String(paymentClaim.attempt_number),
    });

    if (!session.url) {
      await expireOpenSession(stripe, session);
      throw new Error("Stripe n'a pas renvoyé de lien de paiement.");
    }

    try {
      await persistPlatformHeldGroupCheckout({
        groupId: group.id,
        clientProfileId: profile.id,
        attemptToken,
        checkoutSessionId: session.id,
        providerProfileId: group.provider_profile_id,
        stripeAccountId: canonicalStripeAccountId,
        currency: groupCurrency,
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
      event: "stripe_platform_held_group_checkout_created",
      route: "/api/stripe/create-group-checkout-session",
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
      groupId: group.id,
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

    const message =
      error instanceof Error
        ? error.message
        : "Paiement groupé Platform-Held impossible.";
    const status = apiErrorStatus(message);

    logServerWarning({
      event: "stripe_platform_held_group_checkout_failed",
      route: "/api/stripe/create-group-checkout-session",
      method: "POST",
      status,
      code: "stripe_platform_held_group_checkout_failed",
      durationMs: Date.now() - startedAt,
    });

    return secureApiErrorResponse({
      error,
      event: "stripe_platform_held_group_checkout_failed",
      route: "/api/stripe/create-group-checkout-session",
      method: "POST",
      code: "stripe_platform_held_group_checkout_failed",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
