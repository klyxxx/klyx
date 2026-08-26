import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { assessBookingStripeReadiness } from "@/lib/booking-stripe-readiness";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import { inspectStripeRuntime } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_BOOKING_STRIPE_READINESS_API_15_05

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  status: string;
  payment_status: string | null;
};

type ProviderRow = {
  country_code: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
};

function envIsTrue(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: bookingId } = await context.params;
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, booking_group_id, status, payment_status"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      throw new Error(bookingError.message);
    }

    const booking = bookingData as BookingRow | null;

    if (!booking) {
      return NextResponse.json(
        {
          error: "Réservation introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    if (booking.parent_id !== profile.id) {
      return NextResponse.json(
        {
          error: "Accès refusé.",
        },
        {
          status: 403,
        }
      );
    }

    const providerId = booking.provider_id ?? booking.babysitter_id;

    const [splitResult, providerResult] = await Promise.all([
      supabaseAdmin
        .from("split_booking_batch_items")
        .select("batch_id")
        .eq("booking_id", booking.id)
        .limit(1),
      providerId
        ? supabaseAdmin
            .from("profiles")
            .select(
              "country_code, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
            )
            .eq("id", providerId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (splitResult.error) {
      throw new Error(splitResult.error.message);
    }

    if (providerResult.error) {
      throw new Error(providerResult.error.message);
    }

    const provider = (providerResult.data as ProviderRow | null) ?? null;
    const splitMissionPayment = (splitResult.data ?? []).length > 0;

    let stripeRuntime;

    try {
      stripeRuntime = inspectStripeRuntime();
    } catch {
      const readiness = assessBookingStripeReadiness({
        bookingGrouped: Boolean(booking.booking_group_id),
        splitMissionPayment,
        bookingStatus: booking.status,
        paymentStatus: booking.payment_status,
        stripeRuntimeReady: false,
        clientMarketReady: false,
        providerPresent: Boolean(providerId && provider),
        providerMarketReady: false,
        providerStripeReady: false,
        platformOnlyTestPaymentAllowed: false,
      });

      return NextResponse.json({
        bookingId: booking.id,
        ...readiness,
        stripeReadinessComplete: false,
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
      });
    }

    const clientMarketAccess = assessKlyxStripeMarketAccess(
      profile.countryCode,
      stripeRuntime.mode
    );
    const providerMarketAccess = assessKlyxStripeMarketAccess(
      provider?.country_code ?? "",
      stripeRuntime.mode
    );
    const providerStripeReady = Boolean(
      provider?.stripe_account_id &&
        provider.stripe_onboarding_complete &&
        provider.stripe_charges_enabled &&
        provider.stripe_payouts_enabled
    );
    const platformOnlyTestPaymentAllowed = Boolean(
      stripeRuntime.ready &&
        stripeRuntime.mode === "test" &&
        process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") &&
        envIsTrue("KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS")
    );

    const readiness = assessBookingStripeReadiness({
      bookingGrouped: Boolean(booking.booking_group_id),
      splitMissionPayment,
      bookingStatus: booking.status,
      paymentStatus: booking.payment_status,
      stripeRuntimeReady: stripeRuntime.ready,
      clientMarketReady: clientMarketAccess.allowed,
      providerPresent: Boolean(providerId && provider),
      providerMarketReady: providerMarketAccess.allowed,
      providerStripeReady,
      platformOnlyTestPaymentAllowed,
    });

    return NextResponse.json({
      bookingId: booking.id,
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
        : "Vérification Stripe indisponible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "booking_stripe_readiness_failed",
      route: "/api/bookings/[id]/stripe-readiness",
      method: "GET",
      status,
      code: "booking_stripe_readiness_failed",
      publicMessage: status < 500 ? message : undefined,
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
