import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assessBookingGroupPaymentReadiness,
  type BookingGroupPaymentReadinessInput,
} from "../../lib/booking-group-payment-readiness";

// KLYX_GROUP_PAYMENT_READINESS_UNIT_15_03

function readyInput(
  overrides: Partial<BookingGroupPaymentReadinessInput> = {}
): BookingGroupPaymentReadinessInput {
  return {
    isClient: true,
    stripeRuntimeReady: true,
    clientMarketReady: true,
    providerMarketReady: true,
    providerStripeReady: true,
    platformOnlyTestPaymentAllowed: false,
    cancellationPending: false,
    groupStatus: "accepted",
    paymentStatus: "unpaid",
    childBookingsAccepted: true,
    paymentAmountValid: true,
    providerServiceActive: true,
    ...overrides,
  };
}

describe("booking group payment readiness", () => {
  it("blocks checkout when the client market is not ready", () => {
    const result = assessBookingGroupPaymentReadiness(
      readyInput({
        clientMarketReady: false,
      })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.blockReason).toBe("CLIENT_MARKET_NOT_READY");
  });

  it("blocks checkout when the provider market is not ready", () => {
    const result = assessBookingGroupPaymentReadiness(
      readyInput({
        providerMarketReady: false,
      })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.blockReason).toBe("PROVIDER_MARKET_NOT_READY");
  });

  it("blocks checkout when the provider Stripe account is not ready", () => {
    const result = assessBookingGroupPaymentReadiness(
      readyInput({
        providerStripeReady: false,
      })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.providerPaymentReady).toBe(false);
    expect(result.blockReason).toBe("PROVIDER_STRIPE_NOT_READY");
  });

  it("allows checkout only when business and payment infrastructure are ready", () => {
    const result = assessBookingGroupPaymentReadiness(readyInput());

    expect(result.checkoutReady).toBe(true);
    expect(result.paymentInfrastructureReady).toBe(true);
    expect(result.blockReason).toBeNull();
    expect(result.blockMessage).toBeNull();
  });

  it("preserves the explicit platform-only sandbox exception", () => {
    const result = assessBookingGroupPaymentReadiness(
      readyInput({
        providerStripeReady: false,
        platformOnlyTestPaymentAllowed: true,
      })
    );

    expect(result.checkoutReady).toBe(true);
    expect(result.providerPaymentReady).toBe(true);
  });

  it("fails closed while a cancellation request is pending", () => {
    const result = assessBookingGroupPaymentReadiness(
      readyInput({
        cancellationPending: true,
      })
    );

    expect(result.checkoutReady).toBe(false);
    expect(result.blockReason).toBe("CANCELLATION_PENDING");
  });
});
