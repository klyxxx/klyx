import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX babysitter booking i18n contract", () => {
  it("localizes presentation while preserving the booking creation surface", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).toContain("KLYX_BABYSITTER_BOOKING_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain('fetch("/api/bookings/create"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("providerId: babysitter.id");
    expect(page).toContain('serviceSlug: "babysitting"');
    expect(page).toContain("bookingDate: date");
    expect(page).toContain("startTime,");
    expect(page).toContain("endTime,");
    expect(page).toContain("message: bookingMessage");
    expect(page).toContain("onClick={sendRequest}");
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("PaymentIntent");
    expect(page).not.toContain("CheckoutSession");
  });

  it("preserves availability and child-count validation semantics", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).toContain("endTime <= startTime");
    expect(page).toContain("selectedDaySlots.length === 0");
    expect(page).toContain("!isInsideAvailability()");
    expect(page).toContain("Number.isNaN(childrenCount)");
    expect(page).toContain("!Number.isInteger(childrenCount)");
    expect(page).toContain("childrenCount < 1");
    expect(page).toContain("startTime >= slot.start_time.slice(0, 5)");
    expect(page).toContain("endTime <= slot.end_time.slice(0, 5)");
  });

  it("keeps the canonical booking message prefix and user message verbatim", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).toContain("`Nombre d'enfants : ${childrenCount}`");
    expect(page).toContain("message.trim()");
    expect(page).toContain('.join("\\n\\n")');
  });

  it("does not reflect raw Supabase or API error messages", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).not.toContain("profileError.message");
    expect(page).not.toContain("serviceError.message");
    expect(page).not.toContain("userServiceError.message");
    expect(page).not.toContain("serviceProfileError.message");
    expect(page).not.toContain("slotsError.message");
    expect(page).not.toContain("result.error");
    expect(page).not.toContain("error instanceof Error");
  });
});
