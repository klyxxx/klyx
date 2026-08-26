import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getBookingGroupPaymentActionCopy,
} from "@/lib/booking-group-payment-action-copy";

// KLYX_GROUP_PAYMENT_ACTION_COPY_UNIT_15_05

describe("getBookingGroupPaymentActionCopy", () => {
  it("uses a fresh-payment action for unpaid groups", () => {
    expect(
      getBookingGroupPaymentActionCopy("unpaid")
    ).toEqual({
      actionLabel: "Payer",
      note: "Aucun paiement sans ton clic.",
    });
  });

  it("makes an in-progress Stripe session an explicit resume action", () => {
    const copy = getBookingGroupPaymentActionCopy("processing");

    expect(copy.actionLabel).toBe("Reprendre le paiement");
    expect(copy.note).toContain("session Stripe deja preparee");
  });

  it("makes a failed payment an explicit retry action", () => {
    const copy = getBookingGroupPaymentActionCopy("failed");

    expect(copy.actionLabel).toBe("Reessayer le paiement");
    expect(copy.note).toContain("n en recree une que si necessaire");
  });
});
