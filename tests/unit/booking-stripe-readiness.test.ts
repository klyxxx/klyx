import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assessBookingStripeReadiness,
  type BookingStripeReadinessInput,
} from "../../lib/booking-stripe-readiness";

// KLYX_BOOKING_STRIPE_READINESS_UNIT_15_05

function readyInput(
  overrides: Partial<BookingStripeReadinessInput> = {}
): BookingStripeReadinessInput {
  return {
    bookingGrouped: false,
    splitMissionPayment: false,
    bookingStatus: "accepted",
    paymentStatus: "unpaid",
    stripeRuntimeReady: true,
    clientMarketReady: true,
    providerPresent: true,
    providerMarketReady: true,
    providerStripeReady: true,
    platformOnlyTestPaymentAllowed: false,
    ...overrides,
  };
}

describe("booking Stripe readiness", () => {
  it("allows checkout only when the payment infrastructure is ready", () => {
    const result = assessBookingStripeReadiness(readyInput());

    expect(result.checkoutReady).toBe(true);
    expect(result.paymentInfrastructureReady).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it("blocks client markets that are not open", () => {
    const result = assessBookingStripeReadiness(
      readyInput({ clientMarketReady: false })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.blockReason).toBe("CLIENT_MARKET_NOT_READY");
  });

  it("blocks provider markets that are not open", () => {
    const result = assessBookingStripeReadiness(
      readyInput({ providerMarketReady: false })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.blockReason).toBe("PROVIDER_MARKET_NOT_READY");
  });

  it("blocks providers whose Stripe account is incomplete", () => {
    const result = assessBookingStripeReadiness(
      readyInput({ providerStripeReady: false })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.providerPaymentReady).toBe(false);
    expect(result.blockReason).toBe("PROVIDER_STRIPE_NOT_READY");
  });

  it("preserves the explicit platform-only test exception", () => {
    const result = assessBookingStripeReadiness(
      readyInput({
        providerStripeReady: false,
        platformOnlyTestPaymentAllowed: true,
      })
    );

    expect(result.checkoutReady).toBe(true);
    expect(result.providerPaymentReady).toBe(true);
  });

  it("routes grouped bookings away from single-booking checkout", () => {
    const groupResult = assessBookingStripeReadiness(
      readyInput({ bookingGrouped: true })
    );
    const splitResult = assessBookingStripeReadiness(
      readyInput({ splitMissionPayment: true })
    );

    expect(groupResult.blockReason).toBe("GROUP_PAYMENT_REQUIRED");
    expect(splitResult.blockReason).toBe("SPLIT_MISSION_PAYMENT");
  });

  it("fails closed when the Stripe runtime is not ready", () => {
    const result = assessBookingStripeReadiness(
      readyInput({ stripeRuntimeReady: false })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.blockReason).toBe("STRIPE_RUNTIME_NOT_READY");
  });
});
