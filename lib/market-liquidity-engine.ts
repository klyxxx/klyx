export type KlyxLiquidityState =
  | "unknown"
  | "dry"
  | "thin"
  | "constrained"
  | "degraded"
  | "liquid";

export type KlyxTechnicalSupportStatus =
  | "unknown"
  | "unsupported"
  | "experimental"
  | "supported"
  | "degraded";

export type KlyxLiquidityEventType =
  | "demand_created"
  | "request_terminal"
  | "match_found"
  | "availability_confirmed"
  | "quote_created"
  | "quote_accepted"
  | "booking_created"
  | "booking_completed"
  | "booking_cancelled"
  | "replacement_requested"
  | "replacement_succeeded"
  | "supply_capacity_observed";

export type KlyxLiquidityEvent = {
  eventType: KlyxLiquidityEventType;
  requestId: string | null;
  clientProfileId: string | null;
  providerProfileId: string | null;
  occurredAt: string;
  scoreBps: number | null;
  capacityUnits: number | null;
  utilizedUnits: number | null;
  requestStatus: string | null;
  fulfillmentKey: string | null;
};

export type KlyxLiquidityPolicy = {
  id: string;
  minimumDemandSample: number;
  demandMaturitySeconds: number;
  maxTimeToFirstMatchSeconds: number | null;
  maxTimeToQuoteSeconds: number | null;
  minMatchingQualityBps: number | null;
  minAvailabilityProbabilityBps: number | null;
  minQuoteProbabilityBps: number | null;
  minQuoteAcceptanceBps: number | null;
  minBookingConversionBps: number | null;
  minFillRateBps: number | null;
  minCompletionRateBps: number | null;
  maxCancellationRateBps: number | null;
  minReplacementSuccessBps: number | null;
  minRepeatUsageBps: number | null;
  minFulfillmentProbabilityBps: number | null;
  minProviderUtilizationBps: number | null;
  maxProviderUtilizationBps: number | null;
};

export type KlyxLiquidityMetrics = {
  demandCount: number;
  matureDemandCount: number;
  matchedDemandCount: number;
  availabilityConfirmedDemandCount: number;
  quotedDemandCount: number;
  quoteAcceptedDemandCount: number;
  bookedDemandCount: number;
  completedDemandCount: number;
  cancelledBookingDemandCount: number;
  bookingAttemptCount: number;
  completedBookingCount: number;
  cancelledBookingCount: number;
  replacementRequestedCount: number;
  replacementSucceededCount: number;
  timeToFirstMatchSeconds: number | null;
  timeToQuoteSeconds: number | null;
  matchingQualityBps: number | null;
  availabilityProbabilityBps: number | null;
  quoteProbabilityBps: number | null;
  quoteAcceptanceBps: number | null;
  bookingConversionBps: number | null;
  fillRateBps: number | null;
  completionRateBps: number | null;
  cancellationRateBps: number | null;
  replacementSuccessBps: number | null;
  repeatUsageBps: number | null;
  providerUtilizationBps: number | null;
  fulfillmentProbabilityBps: number | null;
};

export type KlyxLiquidityAssessment = {
  technicalSupport: KlyxTechnicalSupportStatus;
  liquidityState: KlyxLiquidityState;
  actuallyLiquid: boolean;
  policyId: string | null;
  metrics: KlyxLiquidityMetrics;
  reasons: string[];
  missingMetrics: string[];
};

type RequestTimeline = {
  demandAt: number | null;
  terminalAt: number | null;
  terminalStatus: string | null;
  firstMatchAt: number | null;
  availabilityConfirmedAt: number | null;
  firstQuoteAt: number | null;
  quoteAcceptedAt: number | null;
  bookingAt: number | null;
  completedAt: number | null;
  bookingCancelledAt: number | null;
  clientProfileId: string | null;
};

type FulfillmentTimeline = {
  createdAt: number | null;
  terminalAt: number | null;
  terminalOutcome: "completed" | "cancelled" | null;
};

function safeTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bps(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.max(
    0,
    Math.min(10_000, Math.round((numerator / denominator) * 10_000))
  );
}

function medianSeconds(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return Math.max(0, Math.round(median / 1000));
}

function averageBps(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(
    0,
    Math.min(
      10_000,
      Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    )
  );
}

function firstAt(current: number | null, next: number): number {
  return current === null ? next : Math.min(current, next);
}

function timelineFor(
  timelines: Map<string, RequestTimeline>,
  requestId: string
): RequestTimeline {
  const existing = timelines.get(requestId);
  if (existing) return existing;

  const created: RequestTimeline = {
    demandAt: null,
    terminalAt: null,
    terminalStatus: null,
    firstMatchAt: null,
    availabilityConfirmedAt: null,
    firstQuoteAt: null,
    quoteAcceptedAt: null,
    bookingAt: null,
    completedAt: null,
    bookingCancelledAt: null,
    clientProfileId: null,
  };
  timelines.set(requestId, created);
  return created;
}

function isMature(
  timeline: RequestTimeline,
  nowMs: number,
  maturitySeconds: number
): boolean {
  if (timeline.demandAt === null) return false;

  // An explicit client/request cancellation is not proof of failed supply.
  // Keep it out of the mature supply denominator unless a booking already existed.
  if (
    timeline.terminalStatus === "cancelled" &&
    timeline.bookingAt === null
  ) {
    return false;
  }

  if (
    timeline.bookingAt !== null ||
    timeline.terminalAt !== null
  ) {
    return true;
  }
  return nowMs - timeline.demandAt >= maturitySeconds * 1000;
}

function checkMinimum(
  value: number | null,
  minimum: number | null,
  key: string,
  reasons: string[],
  missing: string[]
): boolean {
  if (minimum === null) return true;
  if (value === null) {
    missing.push(key);
    return false;
  }
  if (value < minimum) {
    reasons.push(`${key}_below_policy`);
    return false;
  }
  return true;
}

function checkMaximum(
  value: number | null,
  maximum: number | null,
  key: string,
  reasons: string[],
  missing: string[]
): boolean {
  if (maximum === null) return true;
  if (value === null) {
    missing.push(key);
    return false;
  }
  if (value > maximum) {
    reasons.push(`${key}_above_policy`);
    return false;
  }
  return true;
}

export function computeKlyxLiquidityMetrics(params: {
  events: KlyxLiquidityEvent[];
  now?: Date;
  demandMaturitySeconds: number;
}): KlyxLiquidityMetrics {
  const nowMs = (params.now ?? new Date()).getTime();
  const timelines = new Map<string, RequestTimeline>();
  const fulfillments = new Map<string, FulfillmentTimeline>();
  const matchScores: number[] = [];
  let replacementRequestedCount = 0;
  let replacementSucceededCount = 0;
  let capacityUnits = 0;
  let utilizedUnits = 0;

  for (const event of params.events) {
    const occurredAt = safeTimestamp(event.occurredAt);
    if (occurredAt === null) continue;

    if (event.eventType === "replacement_requested") {
      replacementRequestedCount += 1;
    } else if (event.eventType === "replacement_succeeded") {
      replacementSucceededCount += 1;
    } else if (event.eventType === "supply_capacity_observed") {
      capacityUnits += Math.max(0, Math.round(event.capacityUnits ?? 0));
      utilizedUnits += Math.max(0, Math.round(event.utilizedUnits ?? 0));
    }

    if (
      event.eventType === "match_found" &&
      event.scoreBps !== null &&
      Number.isFinite(event.scoreBps)
    ) {
      matchScores.push(Math.max(0, Math.min(10_000, Math.round(event.scoreBps))));
    }

    if (
      event.fulfillmentKey &&
      (
        event.eventType === "booking_created" ||
        event.eventType === "booking_completed" ||
        event.eventType === "booking_cancelled"
      )
    ) {
      const fulfillment =
        fulfillments.get(event.fulfillmentKey) ?? {
          createdAt: null,
          terminalAt: null,
          terminalOutcome: null,
        };

      if (event.eventType === "booking_created") {
        fulfillment.createdAt = firstAt(
          fulfillment.createdAt,
          occurredAt
        );
      } else if (
        fulfillment.terminalAt === null ||
        occurredAt >= fulfillment.terminalAt
      ) {
        fulfillment.terminalAt = occurredAt;
        fulfillment.terminalOutcome =
          event.eventType === "booking_completed"
            ? "completed"
            : "cancelled";
      }

      fulfillments.set(event.fulfillmentKey, fulfillment);
    }

    if (!event.requestId) continue;
    const timeline = timelineFor(timelines, event.requestId);
    if (event.clientProfileId) {
      timeline.clientProfileId = event.clientProfileId;
    }

    switch (event.eventType) {
      case "demand_created":
        timeline.demandAt = firstAt(timeline.demandAt, occurredAt);
        break;
      case "request_terminal":
        timeline.terminalAt = firstAt(timeline.terminalAt, occurredAt);
        timeline.terminalStatus = event.requestStatus;
        break;
      case "match_found":
        timeline.firstMatchAt = firstAt(timeline.firstMatchAt, occurredAt);
        break;
      case "availability_confirmed":
        timeline.availabilityConfirmedAt = firstAt(
          timeline.availabilityConfirmedAt,
          occurredAt
        );
        break;
      case "quote_created":
        timeline.firstQuoteAt = firstAt(timeline.firstQuoteAt, occurredAt);
        break;
      case "quote_accepted":
        timeline.quoteAcceptedAt = firstAt(timeline.quoteAcceptedAt, occurredAt);
        break;
      case "booking_created":
        timeline.bookingAt = firstAt(timeline.bookingAt, occurredAt);
        break;
      case "booking_completed":
        timeline.completedAt = firstAt(timeline.completedAt, occurredAt);
        break;
      case "booking_cancelled":
        timeline.bookingCancelledAt = firstAt(
          timeline.bookingCancelledAt,
          occurredAt
        );
        break;
      default:
        break;
    }
  }

  const demandTimelines = [...timelines.values()].filter(
    (timeline) => timeline.demandAt !== null
  );
  const mature = demandTimelines.filter((timeline) =>
    isMature(timeline, nowMs, params.demandMaturitySeconds)
  );
  const matched = demandTimelines.filter(
    (timeline) => timeline.firstMatchAt !== null
  );
  const availabilityConfirmed = demandTimelines.filter(
    (timeline) => timeline.availabilityConfirmedAt !== null
  );
  const quoted = demandTimelines.filter(
    (timeline) => timeline.firstQuoteAt !== null
  );
  const accepted = demandTimelines.filter(
    (timeline) => timeline.quoteAcceptedAt !== null
  );
  const booked = demandTimelines.filter(
    (timeline) => timeline.bookingAt !== null
  );
  const acceptedAndBooked = demandTimelines.filter(
    (timeline) =>
      timeline.quoteAcceptedAt !== null &&
      timeline.bookingAt !== null
  );
  const matureBooked = mature.filter(
    (timeline) => timeline.bookingAt !== null
  );
  const completed = booked.filter(
    (timeline) => timeline.completedAt !== null
  );
  const cancelledBookingDemands = booked.filter(
    (timeline) => timeline.bookingCancelledAt !== null
  );

  const fulfillmentTimelines = [...fulfillments.values()];
  const completedBookings = fulfillmentTimelines.filter(
    (fulfillment) => fulfillment.terminalOutcome === "completed"
  );
  const cancelledBookings = fulfillmentTimelines.filter(
    (fulfillment) => fulfillment.terminalOutcome === "cancelled"
  );
  const terminalBookings = fulfillmentTimelines.filter(
    (fulfillment) => fulfillment.terminalOutcome !== null
  );

  const timeToFirstMatchMs = matched.flatMap((timeline) =>
    timeline.demandAt !== null && timeline.firstMatchAt !== null
      ? [Math.max(0, timeline.firstMatchAt - timeline.demandAt)]
      : []
  );
  const timeToQuoteMs = quoted.flatMap((timeline) =>
    timeline.demandAt !== null && timeline.firstQuoteAt !== null
      ? [Math.max(0, timeline.firstQuoteAt - timeline.demandAt)]
      : []
  );

  const completedByClient = new Map<string, number>();
  for (const timeline of completed) {
    if (!timeline.clientProfileId) continue;
    completedByClient.set(
      timeline.clientProfileId,
      (completedByClient.get(timeline.clientProfileId) ?? 0) + 1
    );
  }
  const completedClients = completedByClient.size;
  const repeatClients = [...completedByClient.values()].filter(
    (count) => count >= 2
  ).length;

  return {
    demandCount: demandTimelines.length,
    matureDemandCount: mature.length,
    matchedDemandCount: matched.length,
    availabilityConfirmedDemandCount: availabilityConfirmed.length,
    quotedDemandCount: quoted.length,
    quoteAcceptedDemandCount: accepted.length,
    bookedDemandCount: booked.length,
    completedDemandCount: completed.length,
    cancelledBookingDemandCount: cancelledBookingDemands.length,
    bookingAttemptCount: fulfillmentTimelines.length,
    completedBookingCount: completedBookings.length,
    cancelledBookingCount: cancelledBookings.length,
    replacementRequestedCount,
    replacementSucceededCount,
    timeToFirstMatchSeconds: medianSeconds(timeToFirstMatchMs),
    timeToQuoteSeconds: medianSeconds(timeToQuoteMs),
    matchingQualityBps: averageBps(matchScores),
    availabilityProbabilityBps: bps(
      availabilityConfirmed.length,
      matched.length
    ),
    quoteProbabilityBps: bps(quoted.length, mature.length),
    quoteAcceptanceBps: bps(accepted.length, quoted.length),
    bookingConversionBps: bps(acceptedAndBooked.length, accepted.length),
    fillRateBps: bps(matureBooked.length, mature.length),
    completionRateBps: bps(completedBookings.length, terminalBookings.length),
    cancellationRateBps: bps(cancelledBookings.length, terminalBookings.length),
    replacementSuccessBps: bps(
      replacementSucceededCount,
      replacementRequestedCount
    ),
    repeatUsageBps: bps(repeatClients, completedClients),
    providerUtilizationBps:
      capacityUnits > 0 ? bps(utilizedUnits, capacityUnits) : null,
    fulfillmentProbabilityBps: bps(completed.length, mature.length),
  };
}

export function assessKlyxMarketLiquidity(params: {
  technicalSupport: KlyxTechnicalSupportStatus;
  events: KlyxLiquidityEvent[];
  policy: KlyxLiquidityPolicy | null;
  now?: Date;
}): KlyxLiquidityAssessment {
  const maturity = params.policy?.demandMaturitySeconds ?? 0;
  const metrics = computeKlyxLiquidityMetrics({
    events: params.events,
    now: params.now,
    demandMaturitySeconds: maturity,
  });
  const reasons: string[] = [];
  const missingMetrics: string[] = [];

  if (params.technicalSupport === "unsupported") {
    return {
      technicalSupport: params.technicalSupport,
      liquidityState: "unknown",
      actuallyLiquid: false,
      policyId: params.policy?.id ?? null,
      metrics,
      reasons: ["service_not_technically_supported"],
      missingMetrics,
    };
  }

  if (!params.policy) {
    return {
      technicalSupport: params.technicalSupport,
      liquidityState: "unknown",
      actuallyLiquid: false,
      policyId: null,
      metrics,
      reasons: ["liquidity_policy_missing"],
      missingMetrics,
    };
  }

  if (metrics.matureDemandCount < params.policy.minimumDemandSample) {
    return {
      technicalSupport: params.technicalSupport,
      liquidityState: "unknown",
      actuallyLiquid: false,
      policyId: params.policy.id,
      metrics,
      reasons: ["insufficient_mature_demand_sample"],
      missingMetrics,
    };
  }

  const checks = [
    checkMaximum(
      metrics.timeToFirstMatchSeconds,
      params.policy.maxTimeToFirstMatchSeconds,
      "time_to_first_match",
      reasons,
      missingMetrics
    ),
    checkMaximum(
      metrics.timeToQuoteSeconds,
      params.policy.maxTimeToQuoteSeconds,
      "time_to_quote",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.matchingQualityBps,
      params.policy.minMatchingQualityBps,
      "matching_quality",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.availabilityProbabilityBps,
      params.policy.minAvailabilityProbabilityBps,
      "availability_probability",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.quoteProbabilityBps,
      params.policy.minQuoteProbabilityBps,
      "quote_probability",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.quoteAcceptanceBps,
      params.policy.minQuoteAcceptanceBps,
      "quote_acceptance",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.bookingConversionBps,
      params.policy.minBookingConversionBps,
      "booking_conversion",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.fillRateBps,
      params.policy.minFillRateBps,
      "fill_rate",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.completionRateBps,
      params.policy.minCompletionRateBps,
      "completion_rate",
      reasons,
      missingMetrics
    ),
    checkMaximum(
      metrics.cancellationRateBps,
      params.policy.maxCancellationRateBps,
      "cancellation_rate",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.replacementSuccessBps,
      params.policy.minReplacementSuccessBps,
      "replacement_success",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.repeatUsageBps,
      params.policy.minRepeatUsageBps,
      "repeat_usage",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.fulfillmentProbabilityBps,
      params.policy.minFulfillmentProbabilityBps,
      "fulfillment_probability",
      reasons,
      missingMetrics
    ),
    checkMinimum(
      metrics.providerUtilizationBps,
      params.policy.minProviderUtilizationBps,
      "provider_utilization",
      reasons,
      missingMetrics
    ),
    checkMaximum(
      metrics.providerUtilizationBps,
      params.policy.maxProviderUtilizationBps,
      "provider_utilization",
      reasons,
      missingMetrics
    ),
  ];

  if (missingMetrics.length > 0) {
    return {
      technicalSupport: params.technicalSupport,
      liquidityState: "unknown",
      actuallyLiquid: false,
      policyId: params.policy.id,
      metrics,
      reasons: [...new Set(reasons)],
      missingMetrics: [...new Set(missingMetrics)],
    };
  }

  if (checks.every(Boolean)) {
    const technicallyRunnable =
      params.technicalSupport === "supported" ||
      params.technicalSupport === "experimental";

    return {
      technicalSupport: params.technicalSupport,
      liquidityState: "liquid",
      actuallyLiquid: technicallyRunnable,
      policyId: params.policy.id,
      metrics,
      reasons: [],
      missingMetrics: [],
    };
  }

  let liquidityState: KlyxLiquidityState = "thin";

  const dryFailure =
    (
      reasons.some((reason) => reason.startsWith("fill_rate")) &&
      metrics.fillRateBps === 0
    ) ||
    (
      reasons.some((reason) => reason.startsWith("quote_probability")) &&
      metrics.quoteProbabilityBps === 0
    );

  if (dryFailure) {
    liquidityState = "dry";
  } else if (
    reasons.some(
      (reason) =>
        reason.startsWith("time_to_first_match") ||
        reason.startsWith("time_to_quote") ||
        reason.startsWith("availability_probability") ||
        reason.startsWith("provider_utilization")
    )
  ) {
    liquidityState = "constrained";
  } else if (
    reasons.some(
      (reason) =>
        reason.startsWith("completion_rate") ||
        reason.startsWith("cancellation_rate") ||
        reason.startsWith("replacement_success") ||
        reason.startsWith("fulfillment_probability")
    )
  ) {
    liquidityState = "degraded";
  }

  return {
    technicalSupport: params.technicalSupport,
    liquidityState,
    actuallyLiquid: false,
    policyId: params.policy.id,
    metrics,
    reasons: [...new Set(reasons)],
    missingMetrics: [],
  };
}
