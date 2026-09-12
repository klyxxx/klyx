import { describe, expect, it } from "vitest";

import { buildKlyxBusinessMetrics } from "@/lib/klyx-business-metrics";

const service = {
  id: "service-furniture",
  name: "Montage de meubles",
  slug: "montage-de-meubles",
};

const tracking = [
  { cost_type: "stripe_fee" as const, tracking_mode: "automated" as const },
  { cost_type: "support" as const, tracking_mode: "manual" as const },
  { cost_type: "fraud_dispute" as const, tracking_mode: "manual" as const },
  { cost_type: "acquisition" as const, tracking_mode: "manual" as const },
];

describe("KLYX Stripe fee completeness", () => {
  it("does not publish Stripe fees or margins when a paid booking has not been synced", () => {
    const result = buildKlyxBusinessMetrics({
      services: [service],
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      completedBookings: [],
      financialBookings: [
        {
          id: "booking-1",
          parent_id: "client-1",
          service_id: service.id,
          quote_id: null,
          status: "completed",
        },
      ],
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
      tracking,
    });

    const finance = result.categories[0].finance;
    expect(finance.grossMissionValueCents).toBe(10_000);
    expect(finance.stripeFeesCents).toBeNull();
    expect(finance.estimatedContributionMarginCents).toBeNull();
    expect(finance.estimatedNetMarginCents).toBeNull();
  });

  it("publishes margins after the paid booking has an attributed Stripe fee", () => {
    const result = buildKlyxBusinessMetrics({
      services: [service],
      requests: [],
      offers: [],
      quotes: [],
      funnelBookings: [],
      completedBookings: [],
      financialBookings: [
        {
          id: "booking-1",
          parent_id: "client-1",
          service_id: service.id,
          quote_id: null,
          status: "completed",
        },
      ],
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
      costs: [
        {
          cost_type: "stripe_fee",
          amount_cents: 320,
          currency: "EUR",
          service_id: service.id,
          booking_id: "booking-1",
        },
      ],
      tracking,
    });

    const finance = result.categories[0].finance;
    expect(finance.stripeFeesCents).toBe(320);
    expect(finance.estimatedContributionMarginCents).toBe(1_180);
    expect(finance.estimatedNetMarginCents).toBe(1_180);
  });
});
