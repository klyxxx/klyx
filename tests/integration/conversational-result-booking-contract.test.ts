import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX conversational result and booking UI", () => {
  it("keeps recommendations to two or three assistant-style choices instead of a marketplace", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("KLYX_CONVERSATIONAL_RESULT_20260911");
    expect(page).toContain("result.providers.slice(0, 3)");
    expect(page).toContain('role="radiogroup"');
    expect(page).toContain('role="radio"');
    expect(page).toContain('data-testid="klyx-provider-option"');
    expect(page).toContain('data-testid="klyx-continue-selected-provider"');
    expect(page).toContain("selectedProviderId");

    expect(page).not.toContain("profileHref");
    expect(page).not.toContain("<details");
    expect(page).not.toContain("lg:grid-cols-[minmax(220px");
    expect(page).not.toContain("xl:grid-cols-5");
    expect(page).not.toContain("violet");
  });

  it("shows only the requested decision information for each provider", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("providerDisplayName");
    expect(page).toContain("formatKlyxRecommendationScore(locale, provider.klyxScore)");
    expect(page).toContain("formatKlyxRecommendationPrice(");
    expect(page).toContain('provider.availabilitySummary || t("availabilityFallback")');
    expect(page).toContain('t("whyRecommended")');
  });

  it("turns provider booking into one conversational confirmation surface", () => {
    const page = read("app/providers/[id]/book/page.tsx");

    expect(page).toContain("KLYX_CONVERSATIONAL_BOOKING_20260911");
    expect(page).toContain('data-testid="klyx-conversational-booking"');
    expect(page).toContain('data-testid="klyx-booking-confirmation"');
    expect(page).toContain('className="mx-auto max-w-3xl"');
    expect(page).not.toContain("lg:grid-cols-[1fr_320px]");
    expect(page).not.toContain("lg:sticky");
    expect(page).not.toContain("violet");
  });

  it("preserves booking, availability and payment boundaries exactly", () => {
    const page = read("app/providers/[id]/book/page.tsx");

    expect(page).toContain('.from("availability_slots")');
    expect(page).toContain('.eq("is_active", true)');
    expect(page).toContain("fitsAvailability");
    expect(page).toContain('fetch("/api/bookings/create", {');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).toContain("providerId,");
    expect(page).toContain("serviceSlug,");
    expect(page).toContain("bookingDate,");
    expect(page).toContain("startTime,");
    expect(page).toContain("endTime,");
    expect(page).toContain("message: bookingMessage,");
    expect(page).toContain("router.push(`/bookings/${result.bookingId}?created=1`)");

    expect(page).not.toContain("/api/stripe/create-checkout-session");
    expect(page).not.toContain("refund");
    expect(page).not.toContain("payment_status");
  });
});
