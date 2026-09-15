import { describe, expect, it } from "vitest";

import {
  buildPlatformHeldPaymentIntentPlan,
  getKlyxSettlementMode,
  KLYX_LEGACY_SETTLEMENT_MODE,
  KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
  KLYX_SETTLEMENT_LIVE_NOT_READY,
  KLYX_SETTLEMENT_MODE_INVALID,
  KLYX_SETTLEMENT_TEST_NOT_ARMED,
  settlementTransferGroup,
} from "@/lib/stripe-settlement-control";

describe("KLYX settlement control mode", () => {
  it("keeps the certified destination-charge mode by default", () => {
    expect(
      getKlyxSettlementMode({
        KLYX_STRIPE_SETTLEMENT_MODE: undefined,
        KLYX_SETTLEMENT_CONTROL_TEST_READY: undefined,
        STRIPE_SECRET_KEY: "sk_live_example",
      })
    ).toBe(KLYX_LEGACY_SETTLEMENT_MODE);
  });

  it("refuses unknown settlement modes", () => {
    expect(() =>
      getKlyxSettlementMode({
        KLYX_STRIPE_SETTLEMENT_MODE: "escrow",
        KLYX_SETTLEMENT_CONTROL_TEST_READY: "true",
        STRIPE_SECRET_KEY: "sk_test_example",
      })
    ).toThrow(KLYX_SETTLEMENT_MODE_INVALID);
  });

  it("requires explicit TEST arming for platform-held mode", () => {
    expect(() =>
      getKlyxSettlementMode({
        KLYX_STRIPE_SETTLEMENT_MODE: "platform_held",
        KLYX_SETTLEMENT_CONTROL_TEST_READY: undefined,
        STRIPE_SECRET_KEY: "sk_test_example",
      })
    ).toThrow(KLYX_SETTLEMENT_TEST_NOT_ARMED);
  });

  it("hard-blocks platform-held mode with a live Stripe secret", () => {
    expect(() =>
      getKlyxSettlementMode({
        KLYX_STRIPE_SETTLEMENT_MODE: "platform_held",
        KLYX_SETTLEMENT_CONTROL_TEST_READY: "true",
        STRIPE_SECRET_KEY: "sk_live_example",
      })
    ).toThrow(KLYX_SETTLEMENT_LIVE_NOT_READY);
  });

  it("allows the architecture only in explicitly armed Stripe TEST mode", () => {
    expect(
      getKlyxSettlementMode({
        KLYX_STRIPE_SETTLEMENT_MODE: "platform_held",
        KLYX_SETTLEMENT_CONTROL_TEST_READY: "true",
        STRIPE_SECRET_KEY: "sk_test_example",
      })
    ).toBe(KLYX_PLATFORM_HELD_SETTLEMENT_MODE);
  });
});

describe("KLYX platform-held payment intent plan", () => {
  it("freezes provider identity and a deterministic transfer group", () => {
    const plan = buildPlatformHeldPaymentIntentPlan({
      subjectType: "booking",
      subjectId: "booking-123",
      providerProfileId: "provider-456",
      providerStripeAccountId: "acct_123456",
      metadata: {
        booking_id: "booking-123",
      },
    });

    expect(plan.paymentMode).toBe("platform_held");
    expect(plan.transferGroup).toBe("klyx:booking:booking-123");
    expect(plan.metadata).toMatchObject({
      booking_id: "booking-123",
      payment_mode: "platform_held",
      settlement_transfer_group: "klyx:booking:booking-123",
      settlement_provider_profile_id: "provider-456",
      settlement_provider_stripe_account_id: "acct_123456",
    });

    expect(plan).not.toHaveProperty("transfer_data");
    expect(plan).not.toHaveProperty("application_fee_amount");
  });

  it("rejects an unfrozen Stripe destination", () => {
    expect(() =>
      buildPlatformHeldPaymentIntentPlan({
        subjectType: "booking",
        subjectId: "booking-123",
        providerProfileId: "provider-456",
        providerStripeAccountId: "",
      })
    ).toThrow("KLYX_SETTLEMENT_STRIPE_ACCOUNT_REQUIRED");
  });

  it("builds stable transfer-group identifiers", () => {
    expect(
      settlementTransferGroup({
        subjectType: "split_unit",
        subjectId: "unit-789",
      })
    ).toBe("klyx:split_unit:unit-789");
  });
});
