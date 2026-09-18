import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { assessBookingGroupPaymentReadiness } from "@/lib/booking-group-payment-readiness";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import { inspectStripeRuntime } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_GROUP_STRIPE_READINESS_API_15_03

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function envIsTrue(name: string) {
  return (
    process.env[name]
      ?.trim()
      .toLowerCase() === "true"
  );
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    const { id: groupId } = await context.params;

    const {
      data: group,
      error: groupError,
    } = await supabaseAdmin
      .from("booking_groups")
      .select(
        "id, client_profile_id, provider_profile_id, user_service_id, status, payment_status, total_amount_cents, currency, cancellation_request_status"
      )
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) {
      throw new Error(groupError.message);
    }

    if (!group) {
      return NextResponse.json(
        {
          error: "Reservation groupee introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const isClient = group.client_profile_id === profile.id;
    const isProvider = group.provider_profile_id === profile.id;

    if (!isClient && !isProvider) {
      return NextResponse.json(
        {
          error: "Acces refuse.",
        },
        {
          status: 403,
        }
      );
    }

    const [
      childBookingsResult,
      providerResult,
      userServiceResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id, status, amount_total")
        .eq("booking_group_id", group.id),
      supabaseAdmin
        .from("profiles")
        .select(
          "country_code, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
        )
        .eq("id", group.provider_profile_id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_services")
        .select("id")
        .eq("id", group.user_service_id)
        .eq("user_id", group.provider_profile_id)
        .eq("active", true)
        .maybeSingle(),
    ]);

    if (childBookingsResult.error) {
      throw new Error(childBookingsResult.error.message);
    }

    if (providerResult.error) {
      throw new Error(providerResult.error.message);
    }

    if (userServiceResult.error) {
      throw new Error(userServiceResult.error.message);
    }

    let stripeRuntime;

    try {
      stripeRuntime = inspectStripeRuntime();
    } catch {
      const readiness = assessBookingGroupPaymentReadiness({
        isClient,
        stripeRuntimeReady: false,
        clientMarketReady: false,
        providerMarketReady: false,
        providerStripeReady: false,
        platformOnlyTestPaymentAllowed: false,
        cancellationPending:
          group.cancellation_request_status === "requested",
        groupStatus: group.status,
        paymentStatus: group.payment_status,
        childBookingsAccepted: false,
        paymentAmountValid: false,
        providerServiceActive: Boolean(userServiceResult.data),
      });

      return NextResponse.json({
        groupId: group.id,
        ...readiness,
        stripeReadinessComplete: false,
        clientMarketReady: false,
        providerMarketReady: false,
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
      });
    }

    const clientMarketAccess = assessKlyxStripeMarketAccess(
      profile.countryCode,
      stripeRuntime.mode
    );
    const provider = providerResult.data;
    const providerMarketAccess = assessKlyxStripeMarketAccess(
      provider?.country_code ?? "",
      stripeRuntime.mode
    );

    const providerStripeReady = Boolean(
      provider?.stripe_account_id &&
        provider?.stripe_onboarding_complete &&
        provider?.stripe_charges_enabled &&
        provider?.stripe_payouts_enabled
    );

    const platformOnlyTestPaymentAllowed = Boolean(
      stripeRuntime.ready &&
        stripeRuntime.mode === "test" &&
        process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") &&
        envIsTrue("KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS")
    );

    const childBookings = childBookingsResult.data ?? [];
    const childBookingsAccepted =
      childBookings.length >= 2 &&
      childBookings.every((booking) => booking.status === "accepted");
    const childTotal = childBookings.reduce(
      (total, booking) => total + Number(booking.amount_total ?? 0),
      0
    );
    const amountTotal = Number(group.total_amount_cents);
    const currency = String(group.currency ?? "")
      .trim()
      .toUpperCase();
    const paymentAmountValid =
      amountTotal >= 50 &&
      childTotal === amountTotal &&
      /^[A-Z]{3}$/.test(currency);

    const readiness = assessBookingGroupPaymentReadiness({
      isClient,
      stripeRuntimeReady: stripeRuntime.ready,
      clientMarketReady: clientMarketAccess.allowed,
      providerMarketReady: providerMarketAccess.allowed,
      providerStripeReady,
      platformOnlyTestPaymentAllowed,
      cancellationPending:
        group.cancellation_request_status === "requested",
      groupStatus: group.status,
      paymentStatus: group.payment_status,
      childBookingsAccepted,
      paymentAmountValid,
      providerServiceActive: Boolean(userServiceResult.data),
    });

    return NextResponse.json({
      groupId: group.id,
      ...readiness,
      stripeReadinessComplete: true,
      clientMarketReady: clientMarketAccess.allowed,
      clientMarketCountryCode: clientMarketAccess.countryCode,
      clientMarketReason: clientMarketAccess.reason,
      clientMarketBlockers: clientMarketAccess.blockers,
      providerMarketReady: providerMarketAccess.allowed,
      providerMarketCountryCode: providerMarketAccess.countryCode,
      providerMarketReason: providerMarketAccess.reason,
      providerMarketBlockers: providerMarketAccess.blockers,
      providerStripeReady,
      platformOnlyTestPaymentAllowed,
      explicitPaymentConfirmationRequired: true,
      automaticPayment: false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Verification Stripe indisponible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "booking_group_stripe_readiness_failed",
      route: "/api/booking-groups/[id]/stripe-readiness",
      method: "GET",
      status,
      code: "booking_group_stripe_readiness_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
      details: {
        checkoutReady: false,
        paymentInfrastructureReady: false,
        stripeReadinessComplete: false,
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
      },
    });
  }
}
