// KLYX_BOOKING_STRIPE_READINESS_15_05
// KLYX_BOOKING_READINESS_PARITY_15_06

export type BookingStripeBlockReason =
  | "GROUP_PAYMENT_REQUIRED"
  | "SPLIT_MISSION_PAYMENT"
  | "BOOKING_NOT_ACCEPTED"
  | "ALREADY_PAID"
  | "STRIPE_RUNTIME_NOT_READY"
  | "CLIENT_MARKET_NOT_READY"
  | "PROVIDER_MISSING"
  | "PROVIDER_MARKET_NOT_READY"
  | "BOOKING_SERVICE_INCOMPLETE"
  | "SERVICE_NOT_FOUND"
  | "PROVIDER_SERVICE_INACTIVE"
  | "SERVICE_PROFILE_MISSING"
  | "SERVICE_PRICE_REQUIRED"
  | "BOOKING_DURATION_INVALID"
  | "PAYMENT_AMOUNT_INVALID"
  | "BOOKING_CURRENCY_INVALID"
  | "PROVIDER_STRIPE_NOT_READY";

export type BookingStripeReadinessInput = {
  bookingGrouped: boolean;
  splitMissionPayment: boolean;
  bookingStatus: string;
  paymentStatus: string | null;
  stripeRuntimeReady: boolean;
  clientMarketReady: boolean;
  providerPresent: boolean;
  providerMarketReady: boolean;
  serviceReferencesPresent: boolean;
  serviceExists: boolean;
  providerServiceActive: boolean;
  serviceProfilePresent: boolean;
  servicePricePresent: boolean;
  durationValid: boolean;
  paymentAmountValid: boolean;
  currencyValid: boolean;
  providerStripeReady: boolean;
  platformOnlyTestPaymentAllowed: boolean;
};

export type BookingStripeReadiness = {
  checkoutReady: boolean;
  paymentInfrastructureReady: boolean;
  providerPaymentReady: boolean;
  blockReason: BookingStripeBlockReason | null;
};

export function assessBookingStripeReadiness(
  input: BookingStripeReadinessInput
): BookingStripeReadiness {
  const providerPaymentReady =
    input.providerStripeReady || input.platformOnlyTestPaymentAllowed;

  let blockReason: BookingStripeBlockReason | null = null;

  if (input.bookingGrouped) {
    blockReason = "GROUP_PAYMENT_REQUIRED";
  } else if (input.splitMissionPayment) {
    blockReason = "SPLIT_MISSION_PAYMENT";
  } else if (input.bookingStatus !== "accepted") {
    blockReason = "BOOKING_NOT_ACCEPTED";
  } else if (
    input.paymentStatus === "paid" ||
    input.paymentStatus === "refunded"
  ) {
    blockReason = "ALREADY_PAID";
  } else if (!input.stripeRuntimeReady) {
    blockReason = "STRIPE_RUNTIME_NOT_READY";
  } else if (!input.clientMarketReady) {
    blockReason = "CLIENT_MARKET_NOT_READY";
  } else if (!input.providerPresent) {
    blockReason = "PROVIDER_MISSING";
  } else if (!input.providerMarketReady) {
    blockReason = "PROVIDER_MARKET_NOT_READY";
  } else if (!input.serviceReferencesPresent) {
    blockReason = "BOOKING_SERVICE_INCOMPLETE";
  } else if (!input.serviceExists) {
    blockReason = "SERVICE_NOT_FOUND";
  } else if (!input.providerServiceActive) {
    blockReason = "PROVIDER_SERVICE_INACTIVE";
  } else if (!input.serviceProfilePresent) {
    blockReason = "SERVICE_PROFILE_MISSING";
  } else if (!input.servicePricePresent) {
    blockReason = "SERVICE_PRICE_REQUIRED";
  } else if (!input.durationValid) {
    blockReason = "BOOKING_DURATION_INVALID";
  } else if (!input.paymentAmountValid) {
    blockReason = "PAYMENT_AMOUNT_INVALID";
  } else if (!input.currencyValid) {
    blockReason = "BOOKING_CURRENCY_INVALID";
  } else if (!providerPaymentReady) {
    blockReason = "PROVIDER_STRIPE_NOT_READY";
  }

  const checkoutReady = blockReason === null;

  return {
    checkoutReady,
    paymentInfrastructureReady: checkoutReady,
    providerPaymentReady,
    blockReason,
  };
}
