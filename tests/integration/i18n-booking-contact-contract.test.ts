import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const component = read("app/components/BookingContactCard.tsx");
const api = read("app/api/bookings/[id]/contact/route.ts");
const dictionary = read("lib/klyx-booking-contact-i18n.ts");

describe("KLYX booking contact i18n contract", () => {
  it("keeps the historical contact gate and all three API boundaries", () => {
    expect(component).toContain("KLYX_REVALIDATED_PHONE_CALL_UI_12_74");
    expect(component).toContain("KLYX_BOOKING_CONTACT_I18N_16_11");
    expect(component).toContain('bookingStatus === "accepted"');
    expect(component).toContain('bookingStatus === "completed"');
    expect(component).toContain('encodeURIComponent(bookingId) + "/contact"');
    expect(component).toContain('method: "POST"');
    expect(component).toContain('method: "PUT"');
  });

  it("keeps explicit reveal, audited call and local phone clearing semantics", () => {
    expect(component).toContain('window.location.href = "tel:" + result.phoneNumber');
    expect(component).toContain("payload.displayExpiresAt");
    expect(component).toContain("window.setTimeout");
    expect(component).toContain("phoneNumber: null");
    expect(component).toContain("displayExpiresAt: null");
    expect(component).toContain('href="/settings"');

    expect(api).toContain('"phone_explicit_reveal"');
    expect(api).toContain('"phone_call_started"');
    expect(api).toContain("const DISPLAY_MINUTES = 5");
    expect(api).toContain("const COMPLETED_CONTACT_HOURS = 24");
  });

  it("uses stable reason codes and locale-driven expiry instead of reflected server copy", () => {
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain("bookingContactReasonMessage");
    expect(component).toContain("formatKlyxBookingContactExpiry");
    expect(component).not.toContain("payload.error");
    expect(component).not.toContain("payload.message");
    expect(component).not.toContain("result.error");
    expect(dictionary).toContain("REASON_KEYS");
    expect(dictionary).toContain('status_not_allowed: "statusNotAllowed"');
    expect(dictionary).toContain('contact_expired: "contactExpired"');
    expect(dictionary).toContain('own_unverified_phone: "ownUnverifiedPhone"');
    expect(dictionary).toContain('other_private_phone: "otherPrivatePhone"');
  });

  it("does not weaken the contact API authorization or audit behavior", () => {
    expect(api).toContain("await getAuthenticatedProfile(request)");
    expect(api).toContain('booking.status !== "accepted"');
    expect(api).toContain('booking.status !== "completed"');
    expect(api).toContain('phone_visibility ===\n      "transaction_participants"');
    expect(api).toContain('.from("phone_contact_access_logs")');
    expect(api).toContain(".insert({");
    expect(api).toContain("phoneNumber: null");
  });
});
