import { describe, expect, it } from "vitest";

import {
  buildKlyxBusinessMetrics,
  type KlyxBusinessBookingRow,
} from "@/lib/klyx-business-metrics";

const services = [
  { id: "service-furniture", name: "Montage de meubles", slug: "montage-de-meubles" },
  { id: "service-cleaning", name: "Ménage à domicile", slug: "menage-a-domicile" },
];

const baseTracking = [
  { cost_type: "stripe_fee" as const, tracking_mode: "automated" as const },
  { cost_type: "support" as const, tracking_mode: "manual" as const },
  { cost_type: "fraud_dispute" as const, tracking_mode: "manual" as const },
  { cost_type: "acquisition" as const, tracking_mode: "unavailable" as const },
];

function booking(
  id: string,
  overrides: Partial<KlyxBusinessBookingRow> = {}
): KlyxBusinessBookingRow {
  return {
    id,
    parent_id: "client-1",
    service_id: "service-furniture",
    quote_id: "quote-1",
    status: "completed",
    ...overrides,
  };
}

describe("KLYX real business metrics", () => {
  it("uses real cohort denominators instead of inflating proposal conversion", () => {
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [
        { id: "request-1", client_profile_id: "client-1", service_id: "service-furniture" },
        { id: "request-2", client_profile_id: "client-2", service_id: "service-furniture" },
      ],
      offers: [
        { id: "offer-1", request_id: "request-1" },
        { id: "offer-2", request_id: "request-1" },
        { id: "offer-3", request_id: "request-2" },
      ],
      quotes: [
        { id: "quote-1", market_request_id: "request-1" },
        { id: "quote-2", market_request_id: "request-2" },
      ],
      funnelBookings: [booking("booking-1", { quote_id: "quote-1" })],
      financialBookings: [],
      completedBookings: [],
      ledger: [],
      costs: [],
      tracking: baseTracking,
    });

    const metric = result.categories[0];
    expect(metric.funnel.demands).toBe(2);
    expect(metric.funnel.demandsWithProposal).toBe(2);
    expect(metric.funnel.proposals).toBe(3);
    expect(metric.funnel.bookings).toBe(1);
    expect(metric.funnel.demandToProposalRate).toBe(100);
    expect(metric.funnel.proposalToBookingRate).toBe(33.3);
    expect(metric.funnel.bookingToCompletedRate).toBe(100);
  });

  it("calculates repeat rate from completed missions in the same category", () => {
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      financialBookings: [],
      completedBookings: [
        booking("booking-1"),
        booking("booking-2", { quote_id: "quote-2" }),
        booking("booking-3", { parent_id: "client-2", quote_id: "quote-3" }),
      ],
      ledger: [],
      costs: [],
      tracking: baseTracking,
    });

    const metric = result.categories[0];
    expect(metric.repeat.clientsWithCompletedMission).toBe(2);
    expect(metric.repeat.repeatClients).toBe(1);
    expect(metric.repeat.repeatRate).toBe(50);
  });

  it("reduces retained commission after a real refund and subtracts tracked operating costs", () => {
    const paidBooking = booking("booking-1");
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      financialBookings: [paidBooking],
      completedBookings: [paidBooking],
      ledger: [
        {
          booking_id: "booking-1",
          entry_type: "payment_succeeded",
          status: "succeeded",
          currency: "EUR",
          gross_amount_cents: 10_000,
          platform_fee_cents: 1_500,
          refund_amount_cents: 0,
        },
        {
          booking_id: "booking-1",
          entry_type: "refund_succeeded",
          status: "succeeded",
          currency: "EUR",
          gross_amount_cents: 0,
          platform_fee_cents: 0,
          refund_amount_cents: 5_000,
        },
      ],
      costs: [
        { cost_type: "stripe_fee", amount_cents: 300, currency: "EUR", service_id: null, booking_id: "booking-1" },
        { cost_type: "support", amount_cents: 100, currency: "EUR", service_id: "service-furniture", booking_id: null },
        { cost_type: "fraud_dispute", amount_cents: 50, currency: "EUR", service_id: "service-furniture", booking_id: null },
      ],
      tracking: baseTracking,
    });

    const finance = result.categories[0].finance;
    expect(finance.grossMissionValueCents).toBe(10_000);
    expect(finance.klyxCommissionCents).toBe(1_500);
    expect(finance.refundsCents).toBe(5_000);
    expect(finance.retainedCommissionAfterRefundsCents).toBe(750);
    expect(finance.stripeFeesCents).toBe(300);
    expect(finance.supportCostCents).toBe(100);
    expect(finance.fraudDisputeCostCents).toBe(50);
    expect(finance.estimatedContributionMarginCents).toBe(300);
  });

  it("keeps estimated net margin unknown while acquisition cost is unavailable", () => {
    const paidBooking = booking("booking-1");
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      financialBookings: [paidBooking],
      completedBookings: [],
      ledger: [
        {
          booking_id: "booking-1",
          entry_type: "payment_succeeded",
          status: "succeeded",
          currency: "EUR",
          gross_amount_cents: 10_000,
          platform_fee_cents: 1_500,
          refund_amount_cents: 0,
        },
      ],
      costs: [],
      tracking: baseTracking,
    });

    const finance = result.categories[0].finance;
    expect(finance.acquisitionCostCents).toBeNull();
    expect(finance.estimatedNetMarginCents).toBeNull();
  });

  it("keeps manual acquisition cost unknown in categories without an attributed CAC event", () => {
    const furnitureBooking = booking("booking-furniture");
    const cleaningBooking = booking("booking-cleaning", {
      service_id: "service-cleaning",
      quote_id: "quote-cleaning",
    });
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      financialBookings: [furnitureBooking, cleaningBooking],
      completedBookings: [],
      ledger: [
        {
          booking_id: "booking-furniture",
          entry_type: "payment_succeeded",
          status: "succeeded",
          currency: "EUR",
          gross_amount_cents: 10_000,
          platform_fee_cents: 1_500,
          refund_amount_cents: 0,
        },
        {
          booking_id: "booking-cleaning",
          entry_type: "payment_succeeded",
          status: "succeeded",
          currency: "EUR",
          gross_amount_cents: 20_000,
          platform_fee_cents: 3_000,
          refund_amount_cents: 0,
        },
      ],
      costs: [
        { cost_type: "stripe_fee", amount_cents: 300, currency: "EUR", service_id: null, booking_id: "booking-furniture" },
        { cost_type: "stripe_fee", amount_cents: 600, currency: "EUR", service_id: null, booking_id: "booking-cleaning" },
        { cost_type: "acquisition", amount_cents: 500, currency: "EUR", service_id: "service-furniture", booking_id: null },
      ],
      tracking: baseTracking.map((row) =>
        row.cost_type === "acquisition"
          ? { ...row, tracking_mode: "manual" as const }
          : row
      ),
    });

    const furnitureFinance = result.categories.find(
      (category) => category.finance.grossMissionValueCents === 10_000
    )?.finance;
    const cleaningFinance = result.categories.find(
      (category) => category.finance.grossMissionValueCents === 20_000
    )?.finance;

    expect(furnitureFinance?.acquisitionCostCents).toBe(500);
    expect(furnitureFinance?.estimatedNetMarginCents).toBe(700);
    expect(cleaningFinance?.acquisitionCostCents).toBeNull();
    expect(cleaningFinance?.estimatedNetMarginCents).toBeNull();
  });

  it("refuses to aggregate money when a category contains mixed currencies", () => {
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      financialBookings: [booking("booking-1"), booking("booking-2")],
      completedBookings: [],
      ledger: [
        {
          booking_id: "booking-1",
          entry_type: "payment_succeeded",
          status: "succeeded",
          currency: "EUR",
          gross_amount_cents: 10_000,
          platform_fee_cents: 1_500,
          refund_amount_cents: 0,
        },
        {
          booking_id: "booking-2",
          entry_type: "payment_succeeded",
          status: "succeeded",
          currency: "USD",
          gross_amount_cents: 20_000,
          platform_fee_cents: 3_000,
          refund_amount_cents: 0,
        },
      ],
      costs: [],
      tracking: baseTracking,
    });

    const finance = result.categories[0].finance;
    expect(finance.mixedCurrency).toBe(true);
    expect(finance.currency).toBeNull();
    expect(finance.grossMissionValueCents).toBeNull();
    expect(finance.estimatedNetMarginCents).toBeNull();
  });

  it("keeps unattributed costs separate instead of silently assigning them", () => {
    const result = buildKlyxBusinessMetrics({
      services,
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      financialBookings: [],
      completedBookings: [],
      ledger: [],
      costs: [
        {
          cost_type: "support",
          amount_cents: 425,
          currency: "EUR",
          service_id: null,
          booking_id: null,
        },
      ],
      tracking: baseTracking,
    });

    expect(result.categories).toHaveLength(0);
    expect(result.unattributedCosts).toEqual([
      { costType: "support", currency: "EUR", amountCents: 425 },
    ]);
  });
});
