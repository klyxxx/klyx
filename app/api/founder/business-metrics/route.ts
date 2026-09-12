import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  buildKlyxBusinessMetrics,
  type KlyxBusinessBookingRow,
  type KlyxBusinessCostRow,
  type KlyxBusinessLedgerRow,
  type KlyxBusinessOfferRow,
  type KlyxBusinessQuoteRow,
  type KlyxBusinessRequestRow,
  type KlyxBusinessServiceRow,
  type KlyxBusinessTrackingRow,
} from "@/lib/klyx-business-metrics";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  getKlyxLocalPilotCategoryName,
  KLYX_LOCAL_VALUE_PILOT,
} from "@/lib/klyx-local-value-pilot";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_WINDOWS = new Set([7, 30, 90]);

type PilotCostDbRow = {
  id: string;
  cost_type: KlyxBusinessCostRow["cost_type"];
  amount_cents: number;
  currency: string;
  service_id: string | null;
  booking_id: string | null;
  market_request_id: string | null;
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

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

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

async function loadOffers(requestIds: string[]) {
  if (requestIds.length === 0) return [] as KlyxBusinessOfferRow[];
  const { data, error } = await supabaseAdmin
    .from("market_service_offers")
    .select("id, request_id")
    .in("request_id", requestIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as KlyxBusinessOfferRow[];
}

async function loadQuotes(requestIds: string[]) {
  if (requestIds.length === 0) return [] as KlyxBusinessQuoteRow[];
  const { data, error } = await supabaseAdmin
    .from("service_quotes")
    .select("id, market_request_id")
    .in("market_request_id", requestIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as KlyxBusinessQuoteRow[];
}

async function loadBookingsByQuoteIds(quoteIds: string[]) {
  if (quoteIds.length === 0) return [] as KlyxBusinessBookingRow[];
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, parent_id, service_id, quote_id, status")
    .in("quote_id", quoteIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as KlyxBusinessBookingRow[];
}

async function loadBookingsByIds(bookingIds: string[]) {
  if (bookingIds.length === 0) return [] as KlyxBusinessBookingRow[];
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, parent_id, service_id, quote_id, status")
    .in("id", bookingIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as KlyxBusinessBookingRow[];
}

async function loadLedgerByBookingIds(bookingIds: string[]) {
  if (bookingIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("booking_financial_ledger")
    .select(
      "booking_id, entry_type, status, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, refund_amount_cents"
    )
    .in("booking_id", bookingIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadCumulativePilotCosts(
  requestIds: string[],
  bookingIds: string[],
  pilotServiceId: string | null
): Promise<KlyxBusinessCostRow[]> {
  const rows: PilotCostDbRow[] = [];
  const selection =
    "id, cost_type, amount_cents, currency, service_id, booking_id, market_request_id";

  if (requestIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("business_cost_events")
      .select(selection)
      .in("market_request_id", requestIds);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as PilotCostDbRow[]));
  }

  if (bookingIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("business_cost_events")
      .select(selection)
      .in("booking_id", bookingIds);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as PilotCostDbRow[]));
  }

  const deduplicated = new Map(rows.map((row) => [row.id, row] as const));
  return [...deduplicated.values()].map((row) => ({
    cost_type: row.cost_type,
    amount_cents: row.amount_cents,
    currency: row.currency,
    service_id: row.service_id ?? pilotServiceId,
    booking_id: row.booking_id,
  }));
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const days = requestedWindow(request);
    const start = startOfWindow(days);
    const startIso = start.toISOString();

    const [
      servicesResult,
      requestsResult,
      ledgerResult,
      completedResult,
      costsResult,
      trackingResult,
      pilotEnrollmentResult,
      pilotIncomeAttemptsResult,
    ] = await Promise.all([
      supabaseAdmin.from("services").select("id, name, slug"),
      supabaseAdmin
        .from("market_service_requests")
        .select("id, client_profile_id, service_id")
        .gte("created_at", startIso),
      supabaseAdmin
        .from("booking_financial_ledger")
        .select(
          "booking_id, entry_type, status, currency, gross_amount_cents, platform_fee_cents, refund_amount_cents"
        )
        .gte("created_at", startIso),
      supabaseAdmin
        .from("bookings")
        .select("id, parent_id, service_id, quote_id, status")
        .eq("status", "completed")
        .gte("completed_at", startIso),
      supabaseAdmin
        .from("business_cost_events")
        .select(
          "cost_type, amount_cents, currency, service_id, booking_id, market_request_id"
        )
        .gte("occurred_at", startIso),
      supabaseAdmin
        .from("business_cost_tracking_state")
        .select("cost_type, tracking_mode"),
      supabaseAdmin
        .from("business_pilot_requests")
        .select("market_request_id, zone_verified, service_verified")
        .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key)
        .eq("zone_verified", true)
        .eq("service_verified", true),
      supabaseAdmin
        .from("business_pilot_income_attempts")
        .select(
          "provider_profile_id, market_offer_id, income_goal_cents, currency, availability_verified, income_goal_verified"
        )
        .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key)
        .eq("availability_verified", true)
        .eq("income_goal_verified", true),
    ]);

    const firstError = [
      servicesResult.error,
      requestsResult.error,
      ledgerResult.error,
      completedResult.error,
      costsResult.error,
      trackingResult.error,
      pilotEnrollmentResult.error,
      pilotIncomeAttemptsResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const services = (servicesResult.data ?? []) as KlyxBusinessServiceRow[];
    const requests = (requestsResult.data ?? []) as KlyxBusinessRequestRow[];
    const ledger = (ledgerResult.data ?? []) as KlyxBusinessLedgerRow[];
    const completedBookings =
      (completedResult.data ?? []) as KlyxBusinessBookingRow[];
    const costs = (costsResult.data ?? []).map((row) => ({
      cost_type: row.cost_type,
      amount_cents: row.amount_cents,
      currency: row.currency,
      service_id: row.service_id,
      booking_id: row.booking_id,
    })) as KlyxBusinessCostRow[];
    const tracking =
      (trackingResult.data ?? []) as KlyxBusinessTrackingRow[];

    const requestIds = requests.map((row) => row.id);
    const [offers, quotes] = await Promise.all([
      loadOffers(requestIds),
      loadQuotes(requestIds),
    ]);
    const funnelBookings = await loadBookingsByQuoteIds(
      quotes.map((row) => row.id)
    );
    const financialBookingIds = unique([
      ...ledger.map((row) => row.booking_id),
      ...(costsResult.data ?? []).map((row) => row.booking_id),
    ]);
    const financialBookings = await loadBookingsByIds(financialBookingIds);

    const metrics = buildKlyxBusinessMetrics({
      services,
      requests,
      offers,
      quotes,
      funnelBookings,
      financialBookings,
      completedBookings,
      ledger,
      costs,
      tracking,
    });

    const pilotRequestIds = unique(
      (pilotEnrollmentResult.data ?? []).map((row) => row.market_request_id)
    ).slice(0, KLYX_LOCAL_VALUE_PILOT.maxRealRequests);

    const pilotService = services.find(
      (service) => service.slug === KLYX_LOCAL_VALUE_PILOT.serviceSlug
    );

    let pilotRequests: Array<
      KlyxBusinessRequestRow & {
        city: string | null;
        accepted_offer_id: string | null;
      }
    > = [];

    if (pilotRequestIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("market_service_requests")
        .select(
          "id, client_profile_id, service_id, city, accepted_offer_id"
        )
        .in("id", pilotRequestIds);
      if (error) throw new Error(error.message);
      pilotRequests = (data ?? []) as typeof pilotRequests;
    }

    const verifiedPilotRequests = pilotRequests.filter(
      (row) =>
        Boolean(pilotService) &&
        row.service_id === pilotService?.id &&
        isPilotCity(row.city)
    );
    const verifiedPilotRequestIds = verifiedPilotRequests.map(
      (row) => row.id
    );

    const [pilotOffers, pilotQuotes] = await Promise.all([
      loadOffers(verifiedPilotRequestIds),
      loadQuotes(verifiedPilotRequestIds),
    ]);
    const pilotBookings = await loadBookingsByQuoteIds(
      pilotQuotes.map((row) => row.id)
    );
    const pilotBookingIds = pilotBookings.map((row) => row.id);
    const pilotLedgerRaw = await loadLedgerByBookingIds(pilotBookingIds);
    const pilotLedger = pilotLedgerRaw.map((row) => ({
      booking_id: row.booking_id,
      entry_type: row.entry_type,
      status: row.status,
      currency: row.currency,
      gross_amount_cents: row.gross_amount_cents,
      platform_fee_cents: row.platform_fee_cents,
      refund_amount_cents: row.refund_amount_cents,
    })) as KlyxBusinessLedgerRow[];

    const pilotRequestSet = new Set(verifiedPilotRequestIds);
    const pilotCosts = await loadCumulativePilotCosts(
      verifiedPilotRequestIds,
      pilotBookingIds,
      pilotService?.id ?? null
    );

    const pilotMetricResult = buildKlyxBusinessMetrics({
      services,
      requests: verifiedPilotRequests,
      offers: pilotOffers,
      quotes: pilotQuotes,
      funnelBookings: pilotBookings,
      financialBookings: pilotBookings,
      completedBookings: pilotBookings.filter(
        (booking) => booking.status === "completed"
      ),
      ledger: pilotLedger,
      costs: pilotCosts,
      tracking,
    });
    const pilotCategory = pilotMetricResult.categories.find(
      (category) =>
        category.categorySlug === KLYX_LOCAL_VALUE_PILOT.categorySlug
    ) ?? null;

    const paidPilotBookingIds = new Set(
      pilotLedgerRaw
        .filter(
          (row) =>
            row.entry_type === "payment_succeeded" &&
            row.status === "succeeded" &&
            Number(row.gross_amount_cents) > 0
        )
        .map((row) => row.booking_id)
    );
    const providerSettlementBookingIds = new Set(
      pilotLedgerRaw
        .filter(
          (row) =>
            row.entry_type === "payment_succeeded" &&
            row.status === "succeeded" &&
            Number(row.provider_amount_cents ?? 0) > 0
        )
        .map((row) => row.booking_id)
    );
    const completedPaidMissions = pilotBookings.filter(
      (booking) =>
        booking.status === "completed" &&
        paidPilotBookingIds.has(booking.id)
    ).length;

    const offerDetails = new Map<
      string,
      {
        requestId: string;
        providerProfileId: string;
        status: string;
      }
    >();
    const incomeOfferIds = unique(
      (pilotIncomeAttemptsResult.data ?? []).map((row) => row.market_offer_id)
    );
    if (incomeOfferIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("market_service_offers")
        .select("id, request_id, provider_profile_id, status")
        .in("id", incomeOfferIds);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        offerDetails.set(row.id, {
          requestId: row.request_id,
          providerProfileId: row.provider_profile_id,
          status: row.status,
        });
      }
    }

    const bookingsByRequest = new Map<string, KlyxBusinessBookingRow[]>();
    const requestByQuote = new Map(
      pilotQuotes
        .filter((quote) => quote.market_request_id)
        .map((quote) => [quote.id, quote.market_request_id as string] as const)
    );
    for (const booking of pilotBookings) {
      const requestId = booking.quote_id
        ? requestByQuote.get(booking.quote_id)
        : undefined;
      if (!requestId) continue;
      const current = bookingsByRequest.get(requestId) ?? [];
      current.push(booking);
      bookingsByRequest.set(requestId, current);
    }

    const acceptedOfferByRequest = new Map(
      verifiedPilotRequests.map(
        (row) => [row.id, row.accepted_offer_id] as const
      )
    );
    const validIncomeAttempts = (pilotIncomeAttemptsResult.data ?? []).filter(
      (attempt) => {
        const offer = offerDetails.get(attempt.market_offer_id);
        return Boolean(
          offer &&
            offer.providerProfileId === attempt.provider_profile_id &&
            pilotRequestSet.has(offer.requestId)
        );
      }
    );
    const acceptedIncomeAttempts = validIncomeAttempts.filter((attempt) => {
      const offer = offerDetails.get(attempt.market_offer_id);
      return Boolean(
        offer &&
          (offer.status === "accepted" ||
            acceptedOfferByRequest.get(offer.requestId) === attempt.market_offer_id)
      );
    });
    const completedIncomeAttempts = acceptedIncomeAttempts.filter((attempt) => {
      const offer = offerDetails.get(attempt.market_offer_id);
      if (!offer) return false;
      return (bookingsByRequest.get(offer.requestId) ?? []).some(
        (booking) => booking.status === "completed"
      );
    });
    const paidIncomeAttempts = completedIncomeAttempts.filter((attempt) => {
      const offer = offerDetails.get(attempt.market_offer_id);
      if (!offer) return false;
      return (bookingsByRequest.get(offer.requestId) ?? []).some(
        (booking) => providerSettlementBookingIds.has(booking.id)
      );
    });

    return NextResponse.json(
      {
        window: {
          days,
          startDate: startIso.slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
        },
        ...metrics,
        definitions: {
          demandToProposal:
            "Part des demandes de la cohorte ayant reçu au moins une proposition réelle.",
          proposalToBooking:
            "Réservations issues de la cohorte divisées par le nombre total de propositions réelles reçues.",
          bookingToCompleted:
            "Réservations issues de la cohorte qui atteignent réellement le statut completed.",
          repeatRate:
            "Clients avec au moins deux missions completed dans la catégorie sur la fenêtre, divisés par les clients avec au moins une mission completed.",
          margin:
            "La marge contributive retranche commission remboursée estimée, frais Stripe, support et fraude/litiges. Les frais Stripe et les marges restent inconnus tant que chaque réservation payée n'a pas son vrai frais Stripe attribué; la marge nette reste inconnue tant que le coût d'acquisition est indisponible.",
          currency:
            "Aucune agrégation monétaire n'est publiée lorsqu'une catégorie mélange plusieurs devises.",
        },
        pilot: {
          config: {
            ...KLYX_LOCAL_VALUE_PILOT,
            categoryName: getKlyxLocalPilotCategoryName(),
          },
          enrolledRequests: pilotRequestIds.length,
          verifiedRequests: verifiedPilotRequests.length,
          rejectedEnrollmentCount:
            pilotRequestIds.length - verifiedPilotRequests.length,
          activeProviders: new Set(
            validIncomeAttempts.map((row) => row.provider_profile_id)
          ).size,
          completedPaidMissions,
          economicReadReady:
            completedPaidMissions >=
            KLYX_LOCAL_VALUE_PILOT.minimumCompletedPaidMissionsForEconomicRead,
          categoryMetrics: pilotCategory,
          clientLoop: {
            needs: verifiedPilotRequests.length,
            solutions: new Set(
              pilotOffers.map((offer) => offer.request_id)
            ).size,
            paidBookings: paidPilotBookingIds.size,
            completedPaidMissions,
          },
          providerIncomeLoop: {
            verifiedAvailabilityAndIncomeGoals: validIncomeAttempts.length,
            proposalsSent: validIncomeAttempts.length,
            proposalsAccepted: acceptedIncomeAttempts.length,
            missionsCompleted: completedIncomeAttempts.length,
            providerSettlementRecorded: paidIncomeAttempts.length,
            note:
              "providerSettlementRecorded prouve un montant prestataire positif dans le ledger de paiement KLYX; il ne prétend pas prouver le virement bancaire Stripe final.",
          },
          integrity: {
            syntheticTransactionsAllowed:
              KLYX_LOCAL_VALUE_PILOT.syntheticTransactionsAllowed,
            preciseAddressStored: false,
            paidAcquisitionEnabled:
              KLYX_LOCAL_VALUE_PILOT.paidAcquisitionEnabled,
          },
        },
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
      event: "founder_business_metrics_failed",
      route: "/api/founder/business-metrics",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_BUSINESS_METRICS_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
