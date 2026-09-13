export type KlyxPilotRequestRow = {
  id: string;
  accepted_offer_id: string | null;
};

export type KlyxPilotOfferRow = {
  id: string;
  request_id: string;
  provider_profile_id: string;
  status: string | null;
};

export type KlyxPilotQuoteRow = {
  id: string;
  market_request_id: string | null;
};

export type KlyxPilotBookingRow = {
  id: string;
  quote_id: string | null;
  status: string | null;
};

export type KlyxPilotLedgerRow = {
  booking_id: string;
  entry_type: string;
  status: string;
  gross_amount_cents: number | null;
  refund_amount_cents: number | null;
};

export type KlyxPilotIncomeAttemptRow = {
  provider_profile_id: string;
  market_offer_id: string;
  availability_verified: boolean;
  income_goal_verified: boolean;
};

export type KlyxPilotRequestStage =
  | "needs_offer"
  | "needs_acceptance"
  | "needs_booking"
  | "needs_payment"
  | "needs_completion"
  | "financial_review"
  | "completed_paid";

export type KlyxPilotRunStatus =
  | "running"
  | "economic_read_ready"
  | "request_cap_reached_without_proof";

export type KlyxPilotOperatorActionCode =
  | "enroll_first_request"
  | "resolve_financial_review"
  | "secure_payment"
  | "complete_mission"
  | "confirm_booking"
  | "obtain_offer_acceptance"
  | "obtain_real_offer"
  | "enroll_next_request"
  | "analyze_evidence"
  | "stop_and_review";

export type KlyxPilotRequestOperation = {
  requestId: string;
  stage: KlyxPilotRequestStage;
  offerCount: number;
  acceptedOfferId: string | null;
  bookingIds: string[];
  bookingStatuses: string[];
  successfulPaymentCents: number;
  successfulRefundCents: number;
  operatorAction: string;
};

export type KlyxPilotOperationsResult = {
  status: KlyxPilotRunStatus;
  summary: {
    enrolledRequests: number;
    activeProviders: number;
    requestCapacityRemaining: number;
    providerCapacityRemaining: number;
    needsOffer: number;
    needsAcceptance: number;
    needsBooking: number;
    needsPayment: number;
    needsCompletion: number;
    financialReview: number;
    completedPaidMissions: number;
    economicReadReady: boolean;
    requestIntakeLocked: boolean;
    providerEnrollmentLocked: boolean;
    scopeExpansionLocked: true;
  };
  nextAction: {
    code: KlyxPilotOperatorActionCode;
    title: string;
    detail: string;
    requestId: string | null;
  };
  requestQueue: KlyxPilotRequestOperation[];
};

type BuildOperationsInput = {
  requests: KlyxPilotRequestRow[];
  offers: KlyxPilotOfferRow[];
  quotes: KlyxPilotQuoteRow[];
  bookings: KlyxPilotBookingRow[];
  ledger: KlyxPilotLedgerRow[];
  incomeAttempts: KlyxPilotIncomeAttemptRow[];
  maxActiveProviders: number;
  maxRealRequests: number;
  minimumCompletedPaidMissionsForEconomicRead: number;
};

const ACTION_BY_STAGE: Record<KlyxPilotRequestStage, string> = {
  needs_offer: "Obtenir une proposition réelle d'un prestataire qualifié.",
  needs_acceptance: "Obtenir une décision client sur les propositions réelles.",
  needs_booking: "Transformer l'offre acceptée en réservation réelle.",
  needs_payment: "Finaliser ou vérifier le paiement réel de la réservation.",
  needs_completion: "Suivre la mission jusqu'au statut completed, sans le forcer.",
  financial_review:
    "Vérifier le remboursement avant de compter cette mission comme preuve économique.",
  completed_paid: "Aucune action : mission terminée et paiement réel observé.",
};

const STAGE_PRIORITY: Record<KlyxPilotRequestStage, number> = {
  financial_review: 0,
  needs_payment: 1,
  needs_completion: 2,
  needs_booking: 3,
  needs_acceptance: 4,
  needs_offer: 5,
  completed_paid: 6,
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function positiveCents(value: number | null | undefined): number {
  const cents = Number(value ?? 0);
  return Number.isFinite(cents) && cents > 0 ? Math.trunc(cents) : 0;
}

function successfulLedgerAmount(
  rows: KlyxPilotLedgerRow[],
  entryType: "payment_succeeded" | "refund_succeeded",
  field: "gross_amount_cents" | "refund_amount_cents"
): number {
  return rows
    .filter(
      (row) => row.entry_type === entryType && row.status === "succeeded"
    )
    .reduce((sum, row) => sum + positiveCents(row[field]), 0);
}

function stageForRequest(args: {
  offerCount: number;
  acceptedOfferId: string | null;
  bookings: KlyxPilotBookingRow[];
  successfulPaymentCents: number;
  successfulRefundCents: number;
}): KlyxPilotRequestStage {
  const {
    offerCount,
    acceptedOfferId,
    bookings,
    successfulPaymentCents,
    successfulRefundCents,
  } = args;

  const fullyRefunded =
    successfulPaymentCents > 0 &&
    successfulRefundCents >= successfulPaymentCents;
  const hasCompletedBooking = bookings.some(
    (booking) => booking.status === "completed"
  );

  if (fullyRefunded) return "financial_review";
  if (hasCompletedBooking && successfulPaymentCents > 0) return "completed_paid";
  if (bookings.length > 0 && successfulPaymentCents <= 0) return "needs_payment";
  if (bookings.length > 0) return "needs_completion";
  if (acceptedOfferId) return "needs_booking";
  if (offerCount > 0) return "needs_acceptance";
  return "needs_offer";
}

function buildNextAction(args: {
  queue: KlyxPilotRequestOperation[];
  economicReadReady: boolean;
  requestIntakeLocked: boolean;
}): KlyxPilotOperationsResult["nextAction"] {
  const { queue, economicReadReady, requestIntakeLocked } = args;

  if (economicReadReady) {
    return {
      code: "analyze_evidence",
      title: "Analyser les preuves avant toute expansion",
      detail:
        "Le seuil minimal est atteint. Ne pas ouvrir une autre zone ou catégorie automatiquement : analyser marge, conversion et incidents d'abord.",
      requestId: null,
    };
  }

  const pending = queue.find((row) => row.stage !== "completed_paid");
  if (pending) {
    const map: Record<
      Exclude<KlyxPilotRequestStage, "completed_paid">,
      { code: KlyxPilotOperatorActionCode; title: string }
    > = {
      financial_review: {
        code: "resolve_financial_review",
        title: "Résoudre un remboursement avant de conclure",
      },
      needs_payment: {
        code: "secure_payment",
        title: "Sécuriser le paiement d'une réservation réelle",
      },
      needs_completion: {
        code: "complete_mission",
        title: "Suivre la prochaine mission jusqu'à son terme réel",
      },
      needs_booking: {
        code: "confirm_booking",
        title: "Transformer une offre acceptée en réservation",
      },
      needs_acceptance: {
        code: "obtain_offer_acceptance",
        title: "Obtenir une décision client réelle",
      },
      needs_offer: {
        code: "obtain_real_offer",
        title: "Obtenir une proposition réelle",
      },
    };
    const action = map[pending.stage as Exclude<KlyxPilotRequestStage, "completed_paid">];
    return {
      code: action.code,
      title: action.title,
      detail: pending.operatorAction,
      requestId: pending.requestId,
    };
  }

  if (requestIntakeLocked) {
    return {
      code: "stop_and_review",
      title: "Arrêter l'acquisition et analyser le pilote",
      detail:
        "Le plafond de demandes réelles est atteint sans preuve économique minimale. Ne pas augmenter le plafond pour embellir le résultat.",
      requestId: null,
    };
  }

  if (queue.length === 0) {
    return {
      code: "enroll_first_request",
      title: "Enrôler la première demande réelle",
      detail:
        "Obtenir organiquement une vraie demande Anneessens de montage de meubles, puis vérifier explicitement zone et service.",
      requestId: null,
    };
  }

  return {
    code: "enroll_next_request",
    title: "Enrôler la prochaine demande réelle",
    detail:
      "Les demandes actuelles sont terminées. Continuer uniquement dans Anneessens / Montage de meubles et sans acquisition payante.",
    requestId: null,
  };
}

export function buildKlyxLocalPilotOperations(
  input: BuildOperationsInput
): KlyxPilotOperationsResult {
  const requestIds = new Set(input.requests.map((row) => row.id));
  const offers = input.offers.filter((row) => requestIds.has(row.request_id));
  const offersByRequest = new Map<string, KlyxPilotOfferRow[]>();
  for (const offer of offers) {
    const current = offersByRequest.get(offer.request_id) ?? [];
    current.push(offer);
    offersByRequest.set(offer.request_id, current);
  }

  const requestIdByQuoteId = new Map(
    input.quotes
      .filter(
        (row): row is KlyxPilotQuoteRow & { market_request_id: string } =>
          Boolean(row.market_request_id) && requestIds.has(row.market_request_id as string)
      )
      .map((row) => [row.id, row.market_request_id] as const)
  );
  const bookingsByRequest = new Map<string, KlyxPilotBookingRow[]>();
  for (const booking of input.bookings) {
    if (!booking.quote_id) continue;
    const requestId = requestIdByQuoteId.get(booking.quote_id);
    if (!requestId) continue;
    const current = bookingsByRequest.get(requestId) ?? [];
    current.push(booking);
    bookingsByRequest.set(requestId, current);
  }

  const ledgerByBookingId = new Map<string, KlyxPilotLedgerRow[]>();
  for (const row of input.ledger) {
    const current = ledgerByBookingId.get(row.booking_id) ?? [];
    current.push(row);
    ledgerByBookingId.set(row.booking_id, current);
  }

  const requestQueue = input.requests
    .map<KlyxPilotRequestOperation>((request) => {
      const requestOffers = offersByRequest.get(request.id) ?? [];
      const requestBookings = bookingsByRequest.get(request.id) ?? [];
      const requestLedger = requestBookings.flatMap(
        (booking) => ledgerByBookingId.get(booking.id) ?? []
      );
      const successfulPaymentCents = successfulLedgerAmount(
        requestLedger,
        "payment_succeeded",
        "gross_amount_cents"
      );
      const successfulRefundCents = successfulLedgerAmount(
        requestLedger,
        "refund_succeeded",
        "refund_amount_cents"
      );
      const acceptedOfferId =
        request.accepted_offer_id &&
        requestOffers.some((offer) => offer.id === request.accepted_offer_id)
          ? request.accepted_offer_id
          : requestOffers.find((offer) => offer.status === "accepted")?.id ?? null;
      const stage = stageForRequest({
        offerCount: requestOffers.length,
        acceptedOfferId,
        bookings: requestBookings,
        successfulPaymentCents,
        successfulRefundCents,
      });

      return {
        requestId: request.id,
        stage,
        offerCount: requestOffers.length,
        acceptedOfferId,
        bookingIds: unique(requestBookings.map((booking) => booking.id)).sort(),
        bookingStatuses: unique(
          requestBookings
            .map((booking) => booking.status)
            .filter((status): status is string => Boolean(status))
        ).sort(),
        successfulPaymentCents,
        successfulRefundCents,
        operatorAction: ACTION_BY_STAGE[stage],
      };
    })
    .sort((left, right) => {
      const byStage = STAGE_PRIORITY[left.stage] - STAGE_PRIORITY[right.stage];
      return byStage !== 0 ? byStage : left.requestId.localeCompare(right.requestId);
    });

  const pilotOfferIds = new Set(offers.map((row) => row.id));
  const validIncomeAttempts = input.incomeAttempts.filter(
    (row) =>
      row.availability_verified &&
      row.income_goal_verified &&
      pilotOfferIds.has(row.market_offer_id)
  );
  const activeProviders = new Set(
    validIncomeAttempts.map((row) => row.provider_profile_id)
  ).size;
  const completedPaidMissions = requestQueue.filter(
    (row) => row.stage === "completed_paid"
  ).length;
  const economicReadReady =
    completedPaidMissions >= input.minimumCompletedPaidMissionsForEconomicRead;
  const requestIntakeLocked = input.requests.length >= input.maxRealRequests;
  const providerEnrollmentLocked = activeProviders >= input.maxActiveProviders;
  const status: KlyxPilotRunStatus = economicReadReady
    ? "economic_read_ready"
    : requestIntakeLocked
      ? "request_cap_reached_without_proof"
      : "running";

  const count = (stage: KlyxPilotRequestStage) =>
    requestQueue.filter((row) => row.stage === stage).length;

  return {
    status,
    summary: {
      enrolledRequests: input.requests.length,
      activeProviders,
      requestCapacityRemaining: Math.max(
        0,
        input.maxRealRequests - input.requests.length
      ),
      providerCapacityRemaining: Math.max(
        0,
        input.maxActiveProviders - activeProviders
      ),
      needsOffer: count("needs_offer"),
      needsAcceptance: count("needs_acceptance"),
      needsBooking: count("needs_booking"),
      needsPayment: count("needs_payment"),
      needsCompletion: count("needs_completion"),
      financialReview: count("financial_review"),
      completedPaidMissions,
      economicReadReady,
      requestIntakeLocked,
      providerEnrollmentLocked,
      scopeExpansionLocked: true,
    },
    nextAction: buildNextAction({
      queue: requestQueue,
      economicReadReady,
      requestIntakeLocked,
    }),
    requestQueue,
  };
}
