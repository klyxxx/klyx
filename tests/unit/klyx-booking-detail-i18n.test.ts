import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_BOOKING_DETAIL_MESSAGE_KEYS,
  formatKlyxBookingDetailStatus,
  formatKlyxBookingEventNote,
  formatKlyxBookingNextDescription,
  formatKlyxBookingNextTitle,
  formatKlyxBookingPaymentLabel,
  klyxBookingCheckoutErrorKey,
  klyxBookingStatusErrorKey,
  klyxBookingStatusSuccessKey,
  translateKlyxBookingDetail,
} from "@/lib/klyx-booking-detail-i18n";

const locales = ["fr", "en", "nl", "de"] as const;

describe("KLYX booking detail i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of locales) {
      for (const key of KLYX_BOOKING_DETAIL_MESSAGE_KEYS) {
        expect(translateKlyxBookingDetail(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(translateKlyxBookingDetail("es", "tracking")).toBe("Suivi KLYX");
    expect(translateKlyxBookingDetail("es", "manualPaymentSafety")).toBe(
      "Paiement manuel uniquement · aucun débit automatique."
    );
  });

  it("derives stable booking and next-step labels without changing state semantics", () => {
    expect(formatKlyxBookingDetailStatus("en", "accepted")).toBe(
      "Booking accepted"
    );
    expect(
      formatKlyxBookingNextTitle("nl", {
        status: "pending",
        paymentStatus: null,
        role: "provider",
      })
    ).toBe("Een aanvraag wacht op je antwoord");
    expect(
      formatKlyxBookingNextTitle("de", {
        status: "accepted",
        paymentStatus: "pending",
        role: "client",
      })
    ).toContain("Zahlung");
    expect(
      formatKlyxBookingNextDescription("en", {
        status: "accepted",
        paymentStatus: "pending",
        refundStatus: null,
        role: "client",
      })
    ).toContain("Nothing is charged automatically");
  });

  it("keeps payment and refund presentation role-aware", () => {
    expect(
      formatKlyxBookingPaymentLabel("en", {
        paymentStatus: "paid",
        refundStatus: null,
        paymentFailureMessage: null,
        role: "provider",
      })
    ).toBe("Payment received successfully");
    expect(
      formatKlyxBookingPaymentLabel("de", {
        paymentStatus: "paid",
        refundStatus: null,
        paymentFailureMessage: null,
        role: "client",
      })
    ).toBe("Zahlung erfolgreich durchgeführt");
    expect(
      formatKlyxBookingPaymentLabel("nl", {
        paymentStatus: "paid",
        refundStatus: "failed",
        paymentFailureMessage: null,
        role: "client",
      })
    ).toBe("Terugbetaling moet worden gecontroleerd");
  });

  it("maps only known public booking status errors and otherwise fails closed", () => {
    expect(
      klyxBookingStatusErrorKey(undefined, "GROUP_STATUS_REQUIRED")
    ).toBe("apiGroupStatusRequired");
    expect(
      klyxBookingStatusErrorKey(
        "Un autre rendez-vous accepté occupe déjà ce créneau.",
        undefined
      )
    ).toBe("apiTimeConflict");
    expect(klyxBookingStatusErrorKey("postgres secret detail", undefined)).toBe(
      "actionFailed"
    );
    expect(klyxBookingStatusSuccessKey("Réservation acceptée.")).toBe(
      "bookingAccepted"
    );
  });

  it("prefers stable checkout flags and fails closed for unknown payment errors", () => {
    expect(
      klyxBookingCheckoutErrorKey("anything", { alreadyPaid: true })
    ).toBe("apiAlreadyPaid");
    expect(
      klyxBookingCheckoutErrorKey("anything", { paymentPending: true })
    ).toBe("apiPaymentBusy");
    expect(
      klyxBookingCheckoutErrorKey("anything", { splitMissionPayment: true })
    ).toBe("apiSplitMissionPayment");
    expect(
      klyxBookingCheckoutErrorKey("anything", {
        code: "GROUP_PAYMENT_REQUIRED",
      })
    ).toBe("apiGroupPaymentRequired");
    expect(klyxBookingCheckoutErrorKey("stripe internal detail")).toBe(
      "paymentFailed"
    );
  });

  it("localizes only the known system refund suffix while preserving user notes", () => {
    expect(
      formatKlyxBookingEventNote(
        "en",
        "Family emergency. Remboursement Stripe demandé automatiquement."
      )
    ).toBe("Family emergency. Stripe refund requested automatically.");
    expect(formatKlyxBookingEventNote("de", "User-written note")).toBe(
      "User-written note"
    );
  });
});
