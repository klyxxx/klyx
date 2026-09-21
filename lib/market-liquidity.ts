import { decimalToKlyxMinorUnits } from "@/lib/klyx-currency";

export type KlyxLiquidityRequestRow = {
  id: string;
  client_profile_id: string;
  service_id: string;
  market_id: string | null;
  region_id: string | null;
  country_code: string | null;
  currency: string | null;
  budget_max: number | string | null;
  created_at: string;
};

export type KlyxLiquidityCandidateRow = {
  market_request_id: string;
  provider_profile_id: string;
  coverage_count: number;
  slot_count: number;
  full_coverage: boolean;
  created_at: string;
};

export type KlyxLiquidityOfferRow = {
  request_id: string;
  provider_profile_id: string;
  status: string;
  created_at: string;
};

export type KlyxLiquidityQuoteRow = {
  id: string;
  market_request_id: string | null;
  provider_profile_id: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

export type KlyxLiquidityBookingRow = {
  id: string;
  quote_id: string | null;
  provider_id: string | null;
  babysitter_id: string | null;
  status: string;
  created_at: string;
};

export type KlyxLiquidityIncidentRow = {
  id: string;
  booking_id: string;
};

export type KlyxLiquidityIncidentEventRow = {
  incident_id: string;
  event_type: string;
  created_at: string;
};

export type KlyxLiquidityPriceBand = {
  key: string;
  currencyCode: string;
  minAmountMinor: number;
  maxAmountMinor: number | null;
};

export type KlyxMarketLiquidityPolicy = {
  id: string;
  minSampleSize: number;
  maxTimeToFirstMatchSeconds: number | null;
  maxTimeToQuoteSeconds: number | null;
  minQuoteAcceptanceBps: number | null;
  minBookingConversionBps: number | null;
  minFillRateBps: number | null;
  minCompletionRateBps: number | null;
  maxCancellationRateBps: number | null;
  minReplacementSuccessBps: number | null;
  minRepeatUsageBps: number | null;
  minProviderUtilizationBps: number | null;
  minAvailabilityBps: number | null;
  minMatchingQualityBps: number | null;
};

export type KlyxMarketLiquidityMetrics = {
  sampleSize: number;
  matchedDemands: number;
  quotedDemands: number;
  acceptedQuoteDemands: number;
  bookedDemands: number;
  completedDemands: number;
  cancelledBookedDemands: number;
  timeToFirstMatchSeconds: { p50: number | null; p90: number | null };
  timeToQuoteSeconds: { p50: number | null; p90: number | null };
  matchingQuality: number | null;
  quoteProbability: number | null;
  fulfillmentProbability: number | null;
  quoteAcceptanceRate: number | null;
  bookingConversionRate: number | null;
  fillRate: number | null;
  completionRate: number | null;
  cancellationRate: number | null;
  replacementSuccessRate: number | null;
  repeatUsageRate: number | null;
  providerUtilizationRate: number | null;
  availabilityRate: number | null;
};

export type KlyxLiquidityEvaluation = {
  state: "unknown" | "liquid" | "illiquid";
  policyId: string | null;
  reasons: string[];
};

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function bps(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10000);
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  );
  return Math.round(sorted[index]);
}

function firstTimestamp(rows: Array<{ created_at: string }>): number | null {
  let result: number | null = null;
  for (const row of rows) {
    const current = timestamp(row.created_at);
    if (current == null) continue;
    result = result == null ? current : Math.min(result, current);
  }
  return result;
}

function providerId(booking: KlyxLiquidityBookingRow): string | null {
  return booking.provider_id ?? booking.babysitter_id ?? null;
}

export function requestFitsKlyxLiquidityPriceBand(
  request: KlyxLiquidityRequestRow,
  band: KlyxLiquidityPriceBand | null
): boolean {
  if (!band) return true;
  if (!request.currency || request.currency.toUpperCase() !== band.currencyCode) {
    return false;
  }
  if (request.budget_max == null) return false;

  let amountMinor: number;
  try {
    amountMinor = decimalToKlyxMinorUnits(
      String(request.budget_max),
      band.currencyCode
    );
  } catch {
    return false;
  }

  return (
    amountMinor >= band.minAmountMinor &&
    (band.maxAmountMinor == null || amountMinor < band.maxAmountMinor)
  );
}

export function buildKlyxMarketLiquidityMetrics(input: {
  requests: KlyxLiquidityRequestRow[];
  candidates: KlyxLiquidityCandidateRow[];
  offers: KlyxLiquidityOfferRow[];
  quotes: KlyxLiquidityQuoteRow[];
  bookings: KlyxLiquidityBookingRow[];
  incidents: KlyxLiquidityIncidentRow[];
  incidentEvents: KlyxLiquidityIncidentEventRow[];
  priceBand?: KlyxLiquidityPriceBand | null;
}): KlyxMarketLiquidityMetrics {
  const requests = input.requests.filter((request) =>
    requestFitsKlyxLiquidityPriceBand(request, input.priceBand ?? null)
  );
  const requestIds = new Set(requests.map((request) => request.id));

  const candidates = input.candidates.filter((row) =>
    requestIds.has(row.market_request_id)
  );
  const offers = input.offers.filter((row) => requestIds.has(row.request_id));
  const quotes = input.quotes.filter(
    (row) => row.market_request_id && requestIds.has(row.market_request_id)
  );

  const requestIdByQuoteId = new Map<string, string>();
  for (const quote of quotes) {
    if (quote.market_request_id) {
      requestIdByQuoteId.set(quote.id, quote.market_request_id);
    }
  }

  const bookings = input.bookings.filter(
    (row) => row.quote_id && requestIdByQuoteId.has(row.quote_id)
  );
  const requestIdByBookingId = new Map<string, string>();
  for (const booking of bookings) {
    if (!booking.quote_id) continue;
    const requestId = requestIdByQuoteId.get(booking.quote_id);
    if (requestId) requestIdByBookingId.set(booking.id, requestId);
  }

  const candidateByRequest = new Map<string, KlyxLiquidityCandidateRow[]>();
  const offerByRequest = new Map<string, KlyxLiquidityOfferRow[]>();
  const quoteByRequest = new Map<string, KlyxLiquidityQuoteRow[]>();
  const bookingByRequest = new Map<string, KlyxLiquidityBookingRow[]>();

  const push = <T>(map: Map<string, T[]>, key: string, row: T) => {
    const rows = map.get(key) ?? [];
    rows.push(row);
    map.set(key, rows);
  };

  for (const row of candidates) push(candidateByRequest, row.market_request_id, row);
  for (const row of offers) push(offerByRequest, row.request_id, row);
  for (const row of quotes) {
    if (row.market_request_id) push(quoteByRequest, row.market_request_id, row);
  }
  for (const row of bookings) {
    const requestId = requestIdByBookingId.get(row.id);
    if (requestId) push(bookingByRequest, requestId, row);
  }

  let matchedDemands = 0;
  let quotedDemands = 0;
  let acceptedQuoteDemands = 0;
  let bookedDemands = 0;
  let completedDemands = 0;
  let cancelledBookedDemands = 0;
  let availableDemands = 0;
  const firstMatchDurations: number[] = [];
  const firstQuoteDurations: number[] = [];
  const matchingQualities: number[] = [];

  const completedByClient = new Map<string, number>();
  const discoveredProviders = new Set<string>();
  const bookedProviders = new Set<string>();

  for (const request of requests) {
    const started = timestamp(request.created_at);
    const requestCandidates = candidateByRequest.get(request.id) ?? [];
    const requestOffers = offerByRequest.get(request.id) ?? [];
    const requestQuotes = quoteByRequest.get(request.id) ?? [];
    const requestBookings = bookingByRequest.get(request.id) ?? [];

    const firstCandidate = firstTimestamp(requestCandidates);
    const firstOffer = firstTimestamp(requestOffers);
    const firstMatch =
      firstCandidate == null
        ? firstOffer
        : firstOffer == null
          ? firstCandidate
          : Math.min(firstCandidate, firstOffer);

    if (firstMatch != null) {
      matchedDemands += 1;
      if (started != null && firstMatch >= started) {
        firstMatchDurations.push((firstMatch - started) / 1000);
      }
    }

    const firstQuote = firstTimestamp(requestQuotes);
    if (requestQuotes.length > 0) {
      quotedDemands += 1;
      if (started != null && firstQuote != null && firstQuote >= started) {
        firstQuoteDurations.push((firstQuote - started) / 1000);
      }
    }

    if (
      requestQuotes.some(
        (quote) => quote.status === "accepted" || Boolean(quote.accepted_at)
      )
    ) {
      acceptedQuoteDemands += 1;
    }

    if (requestBookings.length > 0) bookedDemands += 1;
    if (requestBookings.some((booking) => booking.status === "completed")) {
      completedDemands += 1;
      completedByClient.set(
        request.client_profile_id,
        (completedByClient.get(request.client_profile_id) ?? 0) + 1
      );
    }
    if (requestBookings.some((booking) => booking.status === "cancelled")) {
      cancelledBookedDemands += 1;
    }

    const fullCoverage =
      requestCandidates.some((candidate) => candidate.full_coverage) ||
      requestOffers.length > 0;
    if (fullCoverage) availableDemands += 1;

    if (requestCandidates.length > 0) {
      let best = 0;
      for (const candidate of requestCandidates) {
        discoveredProviders.add(candidate.provider_profile_id);
        const denominator = Math.max(1, Number(candidate.slot_count));
        best = Math.max(
          best,
          Math.max(0, Math.min(1, Number(candidate.coverage_count) / denominator))
        );
      }
      matchingQualities.push(best);
    } else if (requestOffers.length > 0) {
      for (const offer of requestOffers) {
        discoveredProviders.add(offer.provider_profile_id);
      }
      matchingQualities.push(1);
    }

    for (const booking of requestBookings) {
      const id = providerId(booking);
      if (id) bookedProviders.add(id);
    }
  }

  const incidentIds = new Set(
    input.incidents
      .filter((incident) => requestIdByBookingId.has(incident.booking_id))
      .map((incident) => incident.id)
  );
  const replacementAttemptIds = new Set<string>();
  const replacementSelectedIds = new Set<string>();
  for (const event of input.incidentEvents) {
    if (!incidentIds.has(event.incident_id)) continue;
    if (
      event.event_type === "replacement_search_started" ||
      event.event_type === "replacement_candidates_ready" ||
      event.event_type === "replacement_presented" ||
      event.event_type === "replacement_selected" ||
      event.event_type === "replacement_declined"
    ) {
      replacementAttemptIds.add(event.incident_id);
    }
    if (event.event_type === "replacement_selected") {
      replacementSelectedIds.add(event.incident_id);
    }
  }

  const completedClients = completedByClient.size;
  const repeatClients = [...completedByClient.values()].filter(
    (count) => count >= 2
  ).length;

  let utilizedProviders = 0;
  for (const id of bookedProviders) {
    if (discoveredProviders.has(id)) utilizedProviders += 1;
  }

  return {
    sampleSize: requests.length,
    matchedDemands,
    quotedDemands,
    acceptedQuoteDemands,
    bookedDemands,
    completedDemands,
    cancelledBookedDemands,
    timeToFirstMatchSeconds: {
      p50: percentile(firstMatchDurations, 0.5),
      p90: percentile(firstMatchDurations, 0.9),
    },
    timeToQuoteSeconds: {
      p50: percentile(firstQuoteDurations, 0.5),
      p90: percentile(firstQuoteDurations, 0.9),
    },
    matchingQuality:
      matchingQualities.length === 0
        ? null
        : matchingQualities.reduce((sum, value) => sum + value, 0) /
          matchingQualities.length,
    quoteProbability: ratio(quotedDemands, matchedDemands),
    fulfillmentProbability: ratio(completedDemands, requests.length),
    quoteAcceptanceRate: ratio(acceptedQuoteDemands, quotedDemands),
    bookingConversionRate: ratio(bookedDemands, acceptedQuoteDemands),
    fillRate: ratio(bookedDemands, requests.length),
    completionRate: ratio(completedDemands, bookedDemands),
    cancellationRate: ratio(cancelledBookedDemands, bookedDemands),
    replacementSuccessRate: ratio(
      replacementSelectedIds.size,
      replacementAttemptIds.size
    ),
    repeatUsageRate: ratio(repeatClients, completedClients),
    providerUtilizationRate: ratio(
      utilizedProviders,
      discoveredProviders.size
    ),
    availabilityRate: ratio(availableDemands, requests.length),
  };
}

export function evaluateKlyxMarketLiquidity(
  metrics: KlyxMarketLiquidityMetrics,
  policy: KlyxMarketLiquidityPolicy | null
): KlyxLiquidityEvaluation {
  if (!policy) {
    return {
      state: "unknown",
      policyId: null,
      reasons: ["liquidity_policy_missing"],
    };
  }

  if (metrics.sampleSize < policy.minSampleSize) {
    return {
      state: "unknown",
      policyId: policy.id,
      reasons: ["sample_size_insufficient"],
    };
  }

  const failures: string[] = [];
  const requireAtMost = (
    key: string,
    value: number | null,
    maximum: number | null
  ) => {
    if (maximum == null) return;
    if (value == null || value > maximum) failures.push(key);
  };
  const requireAtLeastBps = (
    key: string,
    value: number | null,
    minimum: number | null
  ) => {
    if (minimum == null) return;
    const actual = bps(value);
    if (actual == null || actual < minimum) failures.push(key);
  };
  const requireAtMostBps = (
    key: string,
    value: number | null,
    maximum: number | null
  ) => {
    if (maximum == null) return;
    const actual = bps(value);
    if (actual == null || actual > maximum) failures.push(key);
  };

  requireAtMost(
    "time_to_first_match",
    metrics.timeToFirstMatchSeconds.p90,
    policy.maxTimeToFirstMatchSeconds
  );
  requireAtMost(
    "time_to_quote",
    metrics.timeToQuoteSeconds.p90,
    policy.maxTimeToQuoteSeconds
  );
  requireAtLeastBps(
    "quote_acceptance",
    metrics.quoteAcceptanceRate,
    policy.minQuoteAcceptanceBps
  );
  requireAtLeastBps(
    "booking_conversion",
    metrics.bookingConversionRate,
    policy.minBookingConversionBps
  );
  requireAtLeastBps("fill_rate", metrics.fillRate, policy.minFillRateBps);
  requireAtLeastBps(
    "completion_rate",
    metrics.completionRate,
    policy.minCompletionRateBps
  );
  requireAtMostBps(
    "cancellation_rate",
    metrics.cancellationRate,
    policy.maxCancellationRateBps
  );
  requireAtLeastBps(
    "replacement_success",
    metrics.replacementSuccessRate,
    policy.minReplacementSuccessBps
  );
  requireAtLeastBps(
    "repeat_usage",
    metrics.repeatUsageRate,
    policy.minRepeatUsageBps
  );
  requireAtLeastBps(
    "provider_utilization",
    metrics.providerUtilizationRate,
    policy.minProviderUtilizationBps
  );
  requireAtLeastBps(
    "availability",
    metrics.availabilityRate,
    policy.minAvailabilityBps
  );
  requireAtLeastBps(
    "matching_quality",
    metrics.matchingQuality,
    policy.minMatchingQualityBps
  );

  return {
    state: failures.length === 0 ? "liquid" : "illiquid",
    policyId: policy.id,
    reasons: failures,
  };
}
