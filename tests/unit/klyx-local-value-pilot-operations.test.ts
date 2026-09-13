import { describe, expect, it } from "vitest";

import {
  buildKlyxLocalPilotOperations,
  type KlyxPilotBookingRow,
  type KlyxPilotLedgerRow,
  type KlyxPilotOfferRow,
  type KlyxPilotQuoteRow,
  type KlyxPilotRequestRow,
} from "@/lib/klyx-local-value-pilot-operations";

type Overrides = {
  requests?: KlyxPilotRequestRow[];
  offers?: KlyxPilotOfferRow[];
  quotes?: KlyxPilotQuoteRow[];
  bookings?: KlyxPilotBookingRow[];
  ledger?: KlyxPilotLedgerRow[];
  incomeAttempts?: Array<{
    provider_profile_id: string;
    market_offer_id: string;
    availability_verified: boolean;
    income_goal_verified: boolean;
  }>;
  maxActiveProviders?: number;
  maxRealRequests?: number;
  minimumCompletedPaidMissionsForEconomicRead?: number;
};

function build(overrides: Overrides = {}) {
  return buildKlyxLocalPilotOperations({
    requests: overrides.requests ?? [],
    offers: overrides.offers ?? [],
    quotes: overrides.quotes ?? [],
    bookings: overrides.bookings ?? [],
    ledger: overrides.ledger ?? [],
    incomeAttempts: overrides.incomeAttempts ?? [],
    maxActiveProviders: overrides.maxActiveProviders ?? 5,
    maxRealRequests: overrides.maxRealRequests ?? 20,
    minimumCompletedPaidMissionsForEconomicRead:
      overrides.minimumCompletedPaidMissionsForEconomicRead ?? 10,
  });
}

const request = (acceptedOfferId: string | null = null): KlyxPilotRequestRow => ({
  id: "request-1",
  accepted_offer_id: acceptedOfferId,
});

const offer: KlyxPilotOfferRow = {
  id: "offer-1",
  request_id: "request-1",
  provider_profile_id: "provider-1",
  status: "pending",
};

const quote: KlyxPilotQuoteRow = {
  id: "quote-1",
  market_request_id: "request-1",
};

const booking = (status: string): KlyxPilotBookingRow => ({
  id: "booking-1",
  quote_id: "quote-1",
  status,
});

const payment: KlyxPilotLedgerRow = {
  booking_id: "booking-1",
  entry_type: "payment_succeeded",
  status: "succeeded",
  gross_amount_cents: 10_000,
  refund_amount_cents: 0,
};

describe("KLYX local value pilot operations", () => {
  it("starts with a real-request action and never invents pilot evidence", () => {
    const result = build();

    expect(result.status).toBe("running");
    expect(result.summary.enrolledRequests).toBe(0);
    expect(result.summary.completedPaidMissions).toBe(0);
    expect(result.summary.scopeExpansionLocked).toBe(true);
    expect(result.nextAction.code).toBe("enroll_first_request");
    expect(result.requestQueue).toEqual([]);
  });

  it("moves a real request through offer, acceptance and booking gates", () => {
    const withoutOffer = build({ requests: [request()] });
    expect(withoutOffer.requestQueue[0].stage).toBe("needs_offer");
    expect(withoutOffer.nextAction.code).toBe("obtain_real_offer");

    const withOffer = build({ requests: [request()], offers: [offer] });
    expect(withOffer.requestQueue[0].stage).toBe("needs_acceptance");
    expect(withOffer.nextAction.code).toBe("obtain_offer_acceptance");

    const accepted = build({
      requests: [request("offer-1")],
      offers: [{ ...offer, status: "accepted" }],
    });
    expect(accepted.requestQueue[0].stage).toBe("needs_booking");
    expect(accepted.nextAction.code).toBe("confirm_booking");
  });

  it("requires an observed payment before a booking can become completion evidence", () => {
    const unpaid = build({
      requests: [request("offer-1")],
      offers: [{ ...offer, status: "accepted" }],
      quotes: [quote],
      bookings: [booking("confirmed")],
    });
    expect(unpaid.requestQueue[0].stage).toBe("needs_payment");
    expect(unpaid.nextAction.code).toBe("secure_payment");

    const paid = build({
      requests: [request("offer-1")],
      offers: [{ ...offer, status: "accepted" }],
      quotes: [quote],
      bookings: [booking("confirmed")],
      ledger: [payment],
    });
    expect(paid.requestQueue[0].stage).toBe("needs_completion");
    expect(paid.nextAction.code).toBe("complete_mission");
  });

  it("counts only completed and paid real missions toward the proof threshold", () => {
    const result = build({
      requests: [request("offer-1")],
      offers: [{ ...offer, status: "accepted" }],
      quotes: [quote],
      bookings: [booking("completed")],
      ledger: [payment],
      minimumCompletedPaidMissionsForEconomicRead: 1,
    });

    expect(result.requestQueue[0].stage).toBe("completed_paid");
    expect(result.summary.completedPaidMissions).toBe(1);
    expect(result.summary.economicReadReady).toBe(true);
    expect(result.status).toBe("economic_read_ready");
    expect(result.nextAction.code).toBe("analyze_evidence");
  });

  it("does not treat a fully refunded mission as successful economic proof", () => {
    const result = build({
      requests: [request("offer-1")],
      offers: [{ ...offer, status: "accepted" }],
      quotes: [quote],
      bookings: [booking("completed")],
      ledger: [
        payment,
        {
          booking_id: "booking-1",
          entry_type: "refund_succeeded",
          status: "succeeded",
          gross_amount_cents: 0,
          refund_amount_cents: 10_000,
        },
      ],
      minimumCompletedPaidMissionsForEconomicRead: 1,
    });

    expect(result.requestQueue[0].stage).toBe("financial_review");
    expect(result.summary.completedPaidMissions).toBe(0);
    expect(result.summary.financialReview).toBe(1);
    expect(result.nextAction.code).toBe("resolve_financial_review");
  });

  it("counts unique verified providers only when their attempt points to a real pilot offer", () => {
    const result = build({
      requests: [request()],
      offers: [offer],
      maxActiveProviders: 1,
      incomeAttempts: [
        {
          provider_profile_id: "provider-1",
          market_offer_id: "offer-1",
          availability_verified: true,
          income_goal_verified: true,
        },
        {
          provider_profile_id: "provider-fake",
          market_offer_id: "outside-pilot-offer",
          availability_verified: true,
          income_goal_verified: true,
        },
      ],
    });

    expect(result.summary.activeProviders).toBe(1);
    expect(result.summary.providerCapacityRemaining).toBe(0);
    expect(result.summary.providerEnrollmentLocked).toBe(true);
  });

  it("stops request intake at the hard cap instead of silently increasing it", () => {
    const requests = Array.from({ length: 2 }, (_, index) => ({
      id: `request-${index + 1}`,
      accepted_offer_id: null,
    }));
    const offers = requests.map((row, index) => ({
      id: `offer-${index + 1}`,
      request_id: row.id,
      provider_profile_id: "provider-1",
      status: "accepted",
    }));
    const quotes = requests.map((row, index) => ({
      id: `quote-${index + 1}`,
      market_request_id: row.id,
    }));
    const bookings = requests.map((row, index) => ({
      id: `booking-${index + 1}`,
      quote_id: `quote-${index + 1}`,
      status: "completed",
    }));
    const ledger = bookings.map((row) => ({
      booking_id: row.id,
      entry_type: "payment_succeeded",
      status: "succeeded",
      gross_amount_cents: 5_000,
      refund_amount_cents: 0,
    }));

    const result = build({
      requests: requests.map((row, index) => ({
        ...row,
        accepted_offer_id: `offer-${index + 1}`,
      })),
      offers,
      quotes,
      bookings,
      ledger,
      maxRealRequests: 2,
      minimumCompletedPaidMissionsForEconomicRead: 3,
    });

    expect(result.status).toBe("request_cap_reached_without_proof");
    expect(result.summary.requestIntakeLocked).toBe(true);
    expect(result.summary.completedPaidMissions).toBe(2);
    expect(result.nextAction.code).toBe("stop_and_review");
  });
});
