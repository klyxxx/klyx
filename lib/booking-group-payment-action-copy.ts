export type BookingGroupPaymentActionCopy = {
  actionLabel: string;
  note: string;
};

// KLYX_GROUP_PAYMENT_ACTION_COPY_15_05
export function getBookingGroupPaymentActionCopy(
  paymentStatus: string
): BookingGroupPaymentActionCopy {
  if (paymentStatus === "processing") {
    return {
      actionLabel: "Reprendre le paiement",
      note:
        "KLYX reutilise la session Stripe deja preparee lorsqu elle est encore valide.",
    };
  }

  if (paymentStatus === "failed") {
    return {
      actionLabel: "Reessayer le paiement",
      note:
        "KLYX reutilise une session Stripe encore valide et n en recree une que si necessaire.",
    };
  }

  return {
    actionLabel: "Payer",
    note: "Aucun paiement sans ton clic.",
  };
}
