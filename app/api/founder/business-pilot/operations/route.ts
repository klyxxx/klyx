import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  buildKlyxLocalPilotOperations,
  type KlyxPilotBookingRow,
  type KlyxPilotIncomeAttemptRow,
  type KlyxPilotLedgerRow,
  type KlyxPilotOfferRow,
  type KlyxPilotQuoteRow,
  type KlyxPilotRequestRow,
} from "@/lib/klyx-local-value-pilot-operations";
import { KLYX_LOCAL_VALUE_PILOT } from "@/lib/klyx-local-value-pilot";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeCity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function isPilotCity(value: string | null | undefined): boolean {
  const city = normalizeCity(value);
  return city === "bruxelles" || city === "brussels";
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const [serviceResult, enrollmentResult, incomeAttemptResult] =
      await Promise.all([
        supabaseAdmin
          .from("services")
          .select("id")
          .eq("slug", KLYX_LOCAL_VALUE_PILOT.serviceSlug)
          .maybeSingle(),
        supabaseAdmin
          .from("business_pilot_requests")
          .select("market_request_id, zone_verified, service_verified")
          .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key),
        supabaseAdmin
          .from("business_pilot_income_attempts")
          .select(
            "provider_profile_id, market_offer_id, availability_verified, income_goal_verified"
          )
          .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key),
      ]);

    const firstError = [
      serviceResult.error,
      enrollmentResult.error,
      incomeAttemptResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);
    if (!serviceResult.data) throw new Error("KLYX_LOCAL_PILOT_SERVICE_MISSING");

    const enrolledIds = unique(
      (enrollmentResult.data ?? [])
        .filter((row) => row.zone_verified && row.service_verified)
        .map((row) => row.market_request_id)
    ).slice(0, KLYX_LOCAL_VALUE_PILOT.maxRealRequests);

    if (enrolledIds.length === 0) {
      const operations = buildKlyxLocalPilotOperations({
        requests: [],
        offers: [],
        quotes: [],
        bookings: [],
        ledger: [],
        incomeAttempts: [],
        maxActiveProviders: KLYX_LOCAL_VALUE_PILOT.maxActiveProviders,
        maxRealRequests: KLYX_LOCAL_VALUE_PILOT.maxRealRequests,
        minimumCompletedPaidMissionsForEconomicRead:
          KLYX_LOCAL_VALUE_PILOT.minimumCompletedPaidMissionsForEconomicRead,
      });

      return NextResponse.json(
        {
          pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
          generatedAt: new Date().toISOString(),
          excludedEnrollmentCount: 0,
          ...operations,
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const { data: rawRequests, error: requestsError } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, service_id, city, accepted_offer_id")
      .in("id", enrolledIds);
    if (requestsError) throw new Error(requestsError.message);

    const verifiedRequests = (rawRequests ?? []).filter(
      (row) =>
        row.service_id === serviceResult.data.id && isPilotCity(row.city)
    );
    const verifiedRequestIds = verifiedRequests.map((row) => row.id);

    const [offersResult, quotesResult] = await Promise.all([
      verifiedRequestIds.length
        ? supabaseAdmin
            .from("market_service_offers")
            .select("id, request_id, provider_profile_id, status")
            .in("request_id", verifiedRequestIds)
        : Promise.resolve({ data: [], error: null }),
      verifiedRequestIds.length
        ? supabaseAdmin
            .from("service_quotes")
            .select("id, market_request_id")
            .in("market_request_id", verifiedRequestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const relationshipError = [offersResult.error, quotesResult.error].find(Boolean);
    if (relationshipError) throw new Error(relationshipError.message);

    const quotes = (quotesResult.data ?? []) as KlyxPilotQuoteRow[];
    const quoteIds = quotes.map((row) => row.id);
    const bookingsResult = quoteIds.length
      ? await supabaseAdmin
          .from("bookings")
          .select("id, quote_id, status")
          .in("quote_id", quoteIds)
      : { data: [], error: null };
    if (bookingsResult.error) throw new Error(bookingsResult.error.message);

    const bookings = (bookingsResult.data ?? []) as KlyxPilotBookingRow[];
    const bookingIds = bookings.map((row) => row.id);
    const ledgerResult = bookingIds.length
      ? await supabaseAdmin
          .from("booking_financial_ledger")
          .select(
            "booking_id, entry_type, status, gross_amount_cents, refund_amount_cents"
          )
          .in("booking_id", bookingIds)
      : { data: [], error: null };
    if (ledgerResult.error) throw new Error(ledgerResult.error.message);

    const operations = buildKlyxLocalPilotOperations({
      requests: verifiedRequests.map((row) => ({
        id: row.id,
        accepted_offer_id: row.accepted_offer_id,
      })) as KlyxPilotRequestRow[],
      offers: (offersResult.data ?? []) as KlyxPilotOfferRow[],
      quotes,
      bookings,
      ledger: (ledgerResult.data ?? []) as KlyxPilotLedgerRow[],
      incomeAttempts: (incomeAttemptResult.data ?? []) as KlyxPilotIncomeAttemptRow[],
      maxActiveProviders: KLYX_LOCAL_VALUE_PILOT.maxActiveProviders,
      maxRealRequests: KLYX_LOCAL_VALUE_PILOT.maxRealRequests,
      minimumCompletedPaidMissionsForEconomicRead:
        KLYX_LOCAL_VALUE_PILOT.minimumCompletedPaidMissionsForEconomicRead,
    });

    return NextResponse.json(
      {
        pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
        generatedAt: new Date().toISOString(),
        excludedEnrollmentCount:
          enrolledIds.length - verifiedRequests.length,
        ...operations,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_business_pilot_operations_failed",
      route: "/api/founder/business-pilot/operations",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_BUSINESS_PILOT_OPERATIONS_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
