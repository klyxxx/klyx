import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_WINDOWS = new Set([7, 30, 90]);

type SearchMetricRow = {
  metric_date: string;
  metric_key: string;
  metric_count: number | string;
};

function requestedWindow(request: Request): number {
  const value = Number(new URL(request.url).searchParams.get("days"));
  return ALLOWED_WINDOWS.has(value) ? value : 30;
}

function startOfWindow(days: number): Date {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function safeCount(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildSearchSeries(
  rows: SearchMetricRow[],
  start: Date,
  days: number
) {
  const totals = new Map<
    string,
    { withResults: number; noResults: number }
  >();

  for (const row of rows) {
    const current = totals.get(row.metric_date) ?? {
      withResults: 0,
      noResults: 0,
    };
    const count = Math.max(0, Number(row.metric_count) || 0);

    if (row.metric_key === "provider_search_with_results") {
      current.withResults += count;
    } else if (row.metric_key === "provider_search_no_results") {
      current.noResults += count;
    }

    totals.set(row.metric_date, current);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const current = totals.get(key) ?? { withResults: 0, noResults: 0 };

    return {
      date: key,
      searches: current.withResults + current.noResults,
      withResults: current.withResults,
      noResults: current.noResults,
    };
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const days = requestedWindow(request);
    const start = startOfWindow(days);
    const startIso = start.toISOString();
    const startDate = startIso.slice(0, 10);

    const [
      clientsResult,
      quotesResult,
      acceptedQuotesResult,
      bookingsResult,
      paidBookingsResult,
      completedBookingsResult,
      searchResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_type", "client")
        .gte("created_at", startIso),
      supabaseAdmin
        .from("service_quotes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startIso),
      supabaseAdmin
        .from("service_quotes")
        .select("id", { count: "exact", head: true })
        .not("accepted_at", "is", null)
        .gte("accepted_at", startIso),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startIso),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "paid")
        .gte("created_at", startIso),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("created_at", startIso),
      supabaseAdmin
        .from("product_analytics_daily")
        .select("metric_date, metric_key, metric_count")
        .gte("metric_date", startDate)
        .order("metric_date", { ascending: true }),
    ]);

    const firstError = [
      clientsResult.error,
      quotesResult.error,
      acceptedQuotesResult.error,
      bookingsResult.error,
      paidBookingsResult.error,
      completedBookingsResult.error,
      searchResult.error,
    ].find(Boolean);

    if (firstError) {
      throw new Error(firstError.message);
    }

    const series = buildSearchSeries(
      (searchResult.data ?? []) as SearchMetricRow[],
      start,
      days
    );
    const searches = series.reduce((sum, day) => sum + day.searches, 0);
    const searchesWithResults = series.reduce(
      (sum, day) => sum + day.withResults,
      0
    );
    const searchesWithoutResults = series.reduce(
      (sum, day) => sum + day.noResults,
      0
    );
    const quotesRequested = safeCount(quotesResult.count);
    const quotesAccepted = safeCount(acceptedQuotesResult.count);
    const bookingsCreated = safeCount(bookingsResult.count);
    const paidBookings = safeCount(paidBookingsResult.count);

    return NextResponse.json(
      {
        window: {
          days,
          startDate,
          endDate: new Date().toISOString().slice(0, 10),
        },
        metrics: {
          newClientProfiles: safeCount(clientsResult.count),
          searches,
          searchesWithResults,
          searchesWithoutResults,
          quotesRequested,
          quotesAccepted,
          bookingsCreated,
          paidBookings,
          completedBookings: safeCount(completedBookingsResult.count),
        },
        ratios: {
          searchResultRate: percentage(searchesWithResults, searches),
          quotePerSearchVolume: percentage(quotesRequested, searches),
          bookingPerQuoteVolume: percentage(bookingsCreated, quotesRequested),
          paidPerBookingVolume: percentage(paidBookings, bookingsCreated),
        },
        dailySearches: series,
        privacy: {
          aggregateOnly: true,
          storesUserIdentifiers: false,
          storesSearchText: false,
          storesLocation: false,
          storesIpAddress: false,
          note:
            "Les recherches sont conservées uniquement comme compteurs journaliers agrégés. Les autres volumes proviennent directement des tables métier canoniques.",
        },
        interpretation:
          "Les ratios sont des ratios de volumes sur la période, pas des cohortes utilisateur. Ils peuvent refléter des actions commencées avant la fenêtre.",
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_product_analytics_failed",
      route: "/api/founder/analytics",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_PRODUCT_ANALYTICS_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
