import { KLYX_SERVICE_CATALOG } from "@/lib/klyx-service-catalog";

export type KlyxBusinessCostType =
  | "stripe_fee"
  | "support"
  | "fraud_dispute"
  | "acquisition";

export type KlyxCostTrackingMode = "unavailable" | "manual" | "automated";

export type KlyxBusinessServiceRow = {
  id: string;
  name: string | null;
  slug: string | null;
};

export type KlyxBusinessRequestRow = {
  id: string;
  client_profile_id: string;
  service_id: string;
};

export type KlyxBusinessOfferRow = {
  id: string;
  request_id: string;
};

export type KlyxBusinessQuoteRow = {
  id: string;
  market_request_id: string | null;
};

export type KlyxBusinessBookingRow = {
  id: string;
  parent_id: string | null;
  service_id: string | null;
  quote_id: string | null;
  status: string;
};

export type KlyxBusinessLedgerRow = {
  booking_id: string;
  entry_type: string;
  status: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  refund_amount_cents: number;
};

export type KlyxBusinessCostRow = {
  cost_type: KlyxBusinessCostType;
  amount_cents: number;
  currency: string;
  service_id: string | null;
  booking_id: string | null;
};

export type KlyxBusinessTrackingRow = {
  cost_type: KlyxBusinessCostType;
  tracking_mode: KlyxCostTrackingMode;
};

export type KlyxCategoryBusinessMetric = {
  categorySlug: string;
  categoryName: string;
  funnel: {
    demands: number;
    demandsWithProposal: number;
    proposals: number;
    bookings: number;
    completedMissions: number;
    demandToProposalRate: number | null;
    proposalToBookingRate: number | null;
    bookingToCompletedRate: number | null;
  };
  repeat: {
    clientsWithCompletedMission: number;
    repeatClients: number;
    repeatRate: number | null;
  };
  finance: {
    currency: string | null;
    mixedCurrency: boolean;
    grossMissionValueCents: number | null;
    klyxCommissionCents: number | null;
    refundsCents: number | null;
    retainedCommissionAfterRefundsCents: number | null;
    stripeFeesCents: number | null;
    supportCostCents: number | null;
    fraudDisputeCostCents: number | null;
    acquisitionCostCents: number | null;
    estimatedContributionMarginCents: number | null;
    estimatedNetMarginCents: number | null;
  };
};

export type KlyxBusinessMetricsResult = {
  categories: KlyxCategoryBusinessMetric[];
  unattributedCosts: Array<{
    costType: KlyxBusinessCostType;
    currency: string;
    amountCents: number;
  }>;
  tracking: Record<KlyxBusinessCostType, KlyxCostTrackingMode>;
};

const FALLBACK_CATEGORY = {
  slug: "autres-services",
  name: "Autres services",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

const CATEGORY_BY_SERVICE_NAME = new Map(
  KLYX_SERVICE_CATALOG.flatMap((category) =>
    category.services.map((serviceName) => [
      normalize(serviceName),
      { slug: category.slug, name: category.name },
    ] as const)
  )
);

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function safeCents(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function costTrackingMap(
  rows: KlyxBusinessTrackingRow[]
): Record<KlyxBusinessCostType, KlyxCostTrackingMode> {
  const result: Record<KlyxBusinessCostType, KlyxCostTrackingMode> = {
    stripe_fee: "unavailable",
    support: "unavailable",
    fraud_dispute: "unavailable",
    acquisition: "unavailable",
  };

  for (const row of rows) {
    result[row.cost_type] = row.tracking_mode;
  }

  return result;
}

function sumCost(
  costs: KlyxBusinessCostRow[],
  costType: KlyxBusinessCostType,
  currency: string
): number {
  return costs.reduce(
    (total, row) =>
      row.cost_type === costType && row.currency === currency
        ? total + safeCents(row.amount_cents)
        : total,
    0
  );
}

export function buildKlyxBusinessMetrics(input: {
  services: KlyxBusinessServiceRow[];
  requests: KlyxBusinessRequestRow[];
  offers: KlyxBusinessOfferRow[];
  quotes: KlyxBusinessQuoteRow[];
  funnelBookings: KlyxBusinessBookingRow[];
  financialBookings: KlyxBusinessBookingRow[];
  completedBookings: KlyxBusinessBookingRow[];
  ledger: KlyxBusinessLedgerRow[];
  costs: KlyxBusinessCostRow[];
  tracking: KlyxBusinessTrackingRow[];
}): KlyxBusinessMetricsResult {
  const tracking = costTrackingMap(input.tracking);
  const serviceCategory = new Map<string, { slug: string; name: string }>();

  for (const service of input.services) {
    serviceCategory.set(
      service.id,
      CATEGORY_BY_SERVICE_NAME.get(normalize(service.name)) ?? FALLBACK_CATEGORY
    );
  }

  const categoryMeta = new Map<string, { name: string }>();
  const categoryForService = (serviceId: string | null | undefined) => {
    const category = serviceId
      ? serviceCategory.get(serviceId) ?? FALLBACK_CATEGORY
      : FALLBACK_CATEGORY;
    categoryMeta.set(category.slug, { name: category.name });
    return category;
  };

  const requestCategory = new Map<string, string>();
  for (const request of input.requests) {
    requestCategory.set(request.id, categoryForService(request.service_id).slug);
  }

  const offerCountByRequest = new Map<string, number>();
  for (const offer of input.offers) {
    offerCountByRequest.set(
      offer.request_id,
      (offerCountByRequest.get(offer.request_id) ?? 0) + 1
    );
  }

  const requestByQuote = new Map<string, string>();
  for (const quote of input.quotes) {
    if (quote.market_request_id) {
      requestByQuote.set(quote.id, quote.market_request_id);
    }
  }

  const bookingsByRequest = new Map<string, KlyxBusinessBookingRow[]>();
  for (const booking of input.funnelBookings) {
    const requestId = booking.quote_id
      ? requestByQuote.get(booking.quote_id)
      : undefined;
    if (!requestId) continue;
    const current = bookingsByRequest.get(requestId) ?? [];
    current.push(booking);
    bookingsByRequest.set(requestId, current);
  }

  type MutableFunnel = {
    demands: number;
    demandsWithProposal: number;
    proposals: number;
    bookings: number;
    completedMissions: number;
  };
  const funnels = new Map<string, MutableFunnel>();

  for (const request of input.requests) {
    const categorySlug = requestCategory.get(request.id) ?? FALLBACK_CATEGORY.slug;
    const current = funnels.get(categorySlug) ?? {
      demands: 0,
      demandsWithProposal: 0,
      proposals: 0,
      bookings: 0,
      completedMissions: 0,
    };
    const proposalCount = offerCountByRequest.get(request.id) ?? 0;
    const bookings = bookingsByRequest.get(request.id) ?? [];

    current.demands += 1;
    current.proposals += proposalCount;
    if (proposalCount > 0) current.demandsWithProposal += 1;
    if (bookings.length > 0) current.bookings += 1;
    if (bookings.some((booking) => booking.status === "completed")) {
      current.completedMissions += 1;
    }
    funnels.set(categorySlug, current);
  }

  const repeatCounts = new Map<string, Map<string, number>>();
  for (const booking of input.completedBookings) {
    if (booking.status !== "completed" || !booking.parent_id) continue;
    const category = categoryForService(booking.service_id);
    const clients = repeatCounts.get(category.slug) ?? new Map<string, number>();
    clients.set(booking.parent_id, (clients.get(booking.parent_id) ?? 0) + 1);
    repeatCounts.set(category.slug, clients);
  }

  const financialBookingById = new Map(
    input.financialBookings.map((booking) => [booking.id, booking] as const)
  );

  type BookingMoney = {
    currency: string;
    gross: number;
    commission: number;
    refund: number;
  };
  const bookingMoney = new Map<string, BookingMoney>();

  for (const row of input.ledger) {
    if (row.status !== "succeeded") continue;
    const current = bookingMoney.get(row.booking_id) ?? {
      currency: row.currency,
      gross: 0,
      commission: 0,
      refund: 0,
    };

    if (current.currency !== row.currency) {
      current.currency = "MIXED";
    }

    if (row.entry_type === "payment_succeeded") {
      current.gross += safeCents(row.gross_amount_cents);
      current.commission += safeCents(row.platform_fee_cents);
    } else if (row.entry_type === "refund_succeeded") {
      current.refund += safeCents(row.refund_amount_cents);
    }

    bookingMoney.set(row.booking_id, current);
  }

  type MoneyAccumulator = {
    currencies: Set<string>;
    gross: number;
    commission: number;
    refunds: number;
    retainedCommission: number;
    costs: KlyxBusinessCostRow[];
  };
  const moneyByCategory = new Map<string, MoneyAccumulator>();

  for (const [bookingId, money] of bookingMoney) {
    const booking = financialBookingById.get(bookingId);
    if (!booking) continue;
    const category = categoryForService(booking.service_id);
    const current = moneyByCategory.get(category.slug) ?? {
      currencies: new Set<string>(),
      gross: 0,
      commission: 0,
      refunds: 0,
      retainedCommission: 0,
      costs: [],
    };

    current.currencies.add(money.currency);
    current.gross += money.gross;
    current.commission += money.commission;
    current.refunds += money.refund;
    const refundedShare =
      money.gross > 0 ? Math.min(1, money.refund / money.gross) : 0;
    current.retainedCommission += Math.max(
      0,
      money.commission - Math.round(money.commission * refundedShare)
    );
    moneyByCategory.set(category.slug, current);
  }

  const unattributed = new Map<string, number>();
  for (const cost of input.costs) {
    let serviceId = cost.service_id;
    if (!serviceId && cost.booking_id) {
      serviceId = financialBookingById.get(cost.booking_id)?.service_id ?? null;
    }

    if (!serviceId) {
      const key = `${cost.cost_type}:${cost.currency}`;
      unattributed.set(key, (unattributed.get(key) ?? 0) + safeCents(cost.amount_cents));
      continue;
    }

    const category = categoryForService(serviceId);
    const current = moneyByCategory.get(category.slug) ?? {
      currencies: new Set<string>(),
      gross: 0,
      commission: 0,
      refunds: 0,
      retainedCommission: 0,
      costs: [],
    };
    current.currencies.add(cost.currency);
    current.costs.push(cost);
    moneyByCategory.set(category.slug, current);
  }

  const categorySlugs = new Set<string>([
    ...funnels.keys(),
    ...repeatCounts.keys(),
    ...moneyByCategory.keys(),
  ]);

  const categories = [...categorySlugs].map((categorySlug) => {
    const categoryName = categoryMeta.get(categorySlug)?.name ?? categorySlug;
    const funnel = funnels.get(categorySlug) ?? {
      demands: 0,
      demandsWithProposal: 0,
      proposals: 0,
      bookings: 0,
      completedMissions: 0,
    };
    const clients = repeatCounts.get(categorySlug) ?? new Map<string, number>();
    const repeatClients = [...clients.values()].filter((count) => count >= 2).length;
    const money = moneyByCategory.get(categorySlug) ?? {
      currencies: new Set<string>(),
      gross: 0,
      commission: 0,
      refunds: 0,
      retainedCommission: 0,
      costs: [],
    };
    const currencies = [...money.currencies].filter(Boolean);
    const mixedCurrency = currencies.length > 1 || currencies.includes("MIXED");
    const currency = currencies.length === 1 && !mixedCurrency ? currencies[0] : null;

    let stripeFees: number | null = null;
    let supportCost: number | null = null;
    let fraudDisputeCost: number | null = null;
    let acquisitionCost: number | null = null;
    let contributionMargin: number | null = null;
    let netMargin: number | null = null;

    if (currency) {
      stripeFees =
        tracking.stripe_fee === "unavailable"
          ? null
          : sumCost(money.costs, "stripe_fee", currency);
      supportCost =
        tracking.support === "unavailable"
          ? null
          : sumCost(money.costs, "support", currency);
      fraudDisputeCost =
        tracking.fraud_dispute === "unavailable"
          ? null
          : sumCost(money.costs, "fraud_dispute", currency);
      acquisitionCost =
        tracking.acquisition === "unavailable"
          ? null
          : sumCost(money.costs, "acquisition", currency);

      if (stripeFees !== null && supportCost !== null && fraudDisputeCost !== null) {
        contributionMargin =
          money.retainedCommission - stripeFees - supportCost - fraudDisputeCost;
      }
      if (contributionMargin !== null && acquisitionCost !== null) {
        netMargin = contributionMargin - acquisitionCost;
      }
    }

    return {
      categorySlug,
      categoryName,
      funnel: {
        ...funnel,
        demandToProposalRate: percent(funnel.demandsWithProposal, funnel.demands),
        proposalToBookingRate: percent(funnel.bookings, funnel.demandsWithProposal),
        bookingToCompletedRate: percent(funnel.completedMissions, funnel.bookings),
      },
      repeat: {
        clientsWithCompletedMission: clients.size,
        repeatClients,
        repeatRate: percent(repeatClients, clients.size),
      },
      finance: {
        currency,
        mixedCurrency,
        grossMissionValueCents: currency ? money.gross : null,
        klyxCommissionCents: currency ? money.commission : null,
        refundsCents: currency ? money.refunds : null,
        retainedCommissionAfterRefundsCents: currency ? money.retainedCommission : null,
        stripeFeesCents: stripeFees,
        supportCostCents: supportCost,
        fraudDisputeCostCents: fraudDisputeCost,
        acquisitionCostCents: acquisitionCost,
        estimatedContributionMarginCents: contributionMargin,
        estimatedNetMarginCents: netMargin,
      },
    } satisfies KlyxCategoryBusinessMetric;
  });

  categories.sort((a, b) => {
    const gmvA = a.finance.grossMissionValueCents ?? -1;
    const gmvB = b.finance.grossMissionValueCents ?? -1;
    if (gmvA !== gmvB) return gmvB - gmvA;
    return b.funnel.demands - a.funnel.demands;
  });

  return {
    categories,
    unattributedCosts: [...unattributed.entries()].map(([key, amountCents]) => {
      const [costType, currency] = key.split(":") as [KlyxBusinessCostType, string];
      return { costType, currency, amountCents };
    }),
    tracking,
  };
}
