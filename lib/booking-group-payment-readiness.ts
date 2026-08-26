export type BookingGroupPaymentBlockReason =
  | "NOT_CLIENT"
  | "STRIPE_RUNTIME_NOT_READY"
  | "CLIENT_MARKET_NOT_READY"
  | "CANCELLATION_PENDING"
  | "GROUP_NOT_ACCEPTED"
  | "ALREADY_PAID"
  | "CHILD_BOOKINGS_NOT_ACCEPTED"
  | "PAYMENT_AMOUNT_INVALID"
  | "PROVIDER_SERVICE_INACTIVE"
  | "PROVIDER_MARKET_NOT_READY"
  | "PROVIDER_STRIPE_NOT_READY";

export type BookingGroupPaymentReadinessInput = {
  isClient: boolean;
  stripeRuntimeReady: boolean;
  clientMarketReady: boolean;
  providerMarketReady: boolean;
  providerStripeReady: boolean;
  platformOnlyTestPaymentAllowed: boolean;
  cancellationPending: boolean;
  groupStatus: string;
  paymentStatus: string;
  childBookingsAccepted: boolean;
  paymentAmountValid: boolean;
  providerServiceActive: boolean;
};

export type BookingGroupPaymentReadiness = {
  checkoutReady: boolean;
  paymentInfrastructureReady: boolean;
  providerPaymentReady: boolean;
  blockReason: BookingGroupPaymentBlockReason | null;
  blockMessage: string | null;
};

const BLOCK_MESSAGES: Record<BookingGroupPaymentBlockReason, string> = {
  NOT_CLIENT:
    "Seul le profil client peut lancer le paiement de cette mission groupee.",
  STRIPE_RUNTIME_NOT_READY:
    "Le paiement est temporairement indisponible. La configuration Stripe KLYX doit etre finalisee.",
  CLIENT_MARKET_NOT_READY:
    "KLYX n'est pas encore ouvert aux paiements reels dans le pays de ce profil client.",
  CANCELLATION_PENDING:
    "Une demande d annulation est ouverte. Le paiement reste suspendu jusqu a sa resolution.",
  GROUP_NOT_ACCEPTED:
    "Le prestataire doit accepter tous les creneaux avant le paiement.",
  ALREADY_PAID:
    "Cette mission groupee est deja payee.",
  CHILD_BOOKINGS_NOT_ACCEPTED:
    "Tous les creneaux doivent etre acceptes avant le paiement.",
  PAYMENT_AMOUNT_INVALID:
    "Le montant de la mission doit etre reverifie avant le paiement.",
  PROVIDER_SERVICE_INACTIVE:
    "Le service du prestataire n est plus actif. Le paiement est bloque.",
  PROVIDER_MARKET_NOT_READY:
    "KLYX n'est pas encore ouvert aux paiements reels dans le pays de ce prestataire.",
  PROVIDER_STRIPE_NOT_READY:
    "Le prestataire doit terminer Stripe avant de pouvoir recevoir le paiement.",
};

export function assessBookingGroupPaymentReadiness(
  input: BookingGroupPaymentReadinessInput
): BookingGroupPaymentReadiness {
  const providerPaymentReady =
    input.providerStripeReady ||
    input.platformOnlyTestPaymentAllowed;

  let blockReason: BookingGroupPaymentBlockReason | null = null;

  if (!input.isClient) {
    blockReason = "NOT_CLIENT";
  } else if (!input.stripeRuntimeReady) {
    blockReason = "STRIPE_RUNTIME_NOT_READY";
  } else if (!input.clientMarketReady) {
    blockReason = "CLIENT_MARKET_NOT_READY";
  } else if (input.cancellationPending) {
    blockReason = "CANCELLATION_PENDING";
  } else if (input.groupStatus !== "accepted") {
    blockReason = "GROUP_NOT_ACCEPTED";
  } else if (input.paymentStatus === "paid") {
    blockReason = "ALREADY_PAID";
  } else if (!input.childBookingsAccepted) {
    blockReason = "CHILD_BOOKINGS_NOT_ACCEPTED";
  } else if (!input.paymentAmountValid) {
    blockReason = "PAYMENT_AMOUNT_INVALID";
  } else if (!input.providerServiceActive) {
    blockReason = "PROVIDER_SERVICE_INACTIVE";
  } else if (!input.providerMarketReady) {
    blockReason = "PROVIDER_MARKET_NOT_READY";
  } else if (!providerPaymentReady) {
    blockReason = "PROVIDER_STRIPE_NOT_READY";
  }

  const checkoutReady = blockReason === null;

  return {
    checkoutReady,
    paymentInfrastructureReady: checkoutReady,
    providerPaymentReady,
    blockReason,
    blockMessage:
      blockReason === null
        ? null
        : BLOCK_MESSAGES[blockReason],
  };
}
