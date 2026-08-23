import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/bookings/[id]/page.tsx"),
  "utf8"
);

const dictionary = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-booking-detail-i18n.ts"),
  "utf8"
);

describe("KLYX booking detail i18n contract", () => {
  it("preserves the direct booking read boundaries and secure contact component", () => {
    expect(source).toContain('.from("bookings")');
    expect(source).toContain('.from("booking_status_events")');
    expect(source).toContain('.from("profiles")');
    expect(source).toContain('.from("services")');
    expect(source).toContain("KLYX_SECURE_CONTACT_UI_12_68B");
    expect(source).toContain("<BookingContactCard");
    expect(source).toContain("bookingId={booking.id}");
    expect(source).toContain("bookingStatus={booking.status}");
    expect(source).toContain("otherName={otherName}");
  });

  it("preserves status mutations and their exact payload boundary", () => {
    expect(source).toContain('fetch("/api/bookings/status"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain("JSON.stringify({ bookingId, status, note })");
    expect(source).toContain('updateStatus("accepted")');
    expect(source).toContain('updateStatus("rejected")');
    expect(source).toContain('updateStatus("cancelled")');
    expect(source).toContain(
      'const canProviderAnswer = role === "provider" && booking.status === "pending";'
    );
    expect(source).toContain('["pending", "accepted"].includes(booking.status)');
  });

  it("preserves explicit manual checkout, idempotent retry behavior and unlocks failed payment UI", () => {
    expect(source).toContain('fetch("/api/stripe/create-checkout-session"');
    expect(source).toContain("JSON.stringify({ bookingId })");
    expect(source).toContain("for (let attempt = 0; attempt < 5; attempt += 1)");
    expect(source).toContain("window.setTimeout(resolve, 700)");
    expect(source).toContain("result.alreadyPaid");
    expect(source).toContain("result.paymentPending");
    expect(source).toContain("window.location.href = result.url");
    expect(source).toContain('t("manualPaymentSafety")');
    expect(source).toMatch(
      /if \(!response\.ok \|\| !result\.url\)[\s\S]*setErrorKey\([\s\S]*setActiveAction\(null\);[\s\S]*return;/
    );
    expect(dictionary).toContain(
      "Paiement manuel uniquement · aucun débit automatique."
    );
    expect(dictionary).toContain("Manual payment only · no automatic charge.");
  });

  it("preserves role and lifecycle action guards", () => {
    expect(source).toContain('role === "client" &&');
    expect(source).toContain('booking.status === "accepted" &&');
    expect(source).toContain('booking.payment_status !== "paid" &&');
    expect(source).toContain('booking.payment_status !== "refunded";');
    expect(source).toContain(
      'booking.status === "accepted" && booking.payment_status === "paid";'
    );
    expect(source).toContain('href={`/tracking/${booking.id}`}');
    expect(source).toContain('href={`/messages/${booking.id}`}');
    expect(source).toContain('href={`/reviews/${booking.id}`}');
    expect(source).toContain('href="/bookings"');
  });

  it("keeps user-authored booking content untouched while localizing known system suffixes", () => {
    expect(source).toContain("{booking.message}");
    expect(source).toContain("{booking.provider_response}");
    expect(source).toContain("{booking.cancellation_reason}");
    expect(source).toContain("{booking.payment_failure_message}");
    expect(source).toContain("formatKlyxBookingEventNote(locale, event.note)");
  });

  it("fails closed for unexpected errors and does not refetch only because language changes", () => {
    expect(source).toContain('"loadFailed"');
    expect(source).toContain('setErrorKey("actionFailed")');
    expect(source).toContain('setErrorKey("paymentFailed")');
    expect(source).toContain("klyxBookingStatusErrorKey(result.error, result.code)");
    expect(source).toContain("klyxBookingCheckoutErrorKey(result.error, result)");
    expect(source).not.toContain("setErrorMessage(");
    expect(source).not.toContain("setSuccessMessage(");
    expect(source).not.toContain('new Intl.DateTimeFormat("fr-BE"');
    expect(source).toContain("}, [bookingId, router]);");
  });

  it("retains historical AI-first and review markers", () => {
    expect(source).toContain("KLYX_AI_FIRST_BOOKING_UI_15_01");
    expect(source).toContain("KLYX_BOOKING_NEXT_ACTION_13_69");
    expect(source).toContain("KLYX_VERIFIED_REVIEW_CTA_13_70");
    expect(source).toContain("function JourneyStep(");
  });
});
