import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "app/bookings/page.tsx"),
  "utf8"
);

const dictionary = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-bookings-page-i18n.ts"),
  "utf8"
);

describe("KLYX bookings page i18n contract", () => {
  it("keeps the bookings overview read-only data boundaries", () => {
    expect(page).toContain('fetch("/api/bookings/overview"');
    expect(page).toContain('fetch("/api/bookings/split-missions"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain('Authorization: "Bearer " + token');
    expect(page).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  it("preserves grouped-child hiding and booking classification semantics", () => {
    expect(page).toContain("KLYX_SPLIT_MISSION_CHILD_FILTER_13_21D");
    expect(page).toContain("KLYX_SPLIT_MISSION_COUNTS_13_21D");
    expect(page).toContain("booking.actionRequired");
    expect(page).toContain("booking.history");
    expect(page).toContain("splitMissionNeedsAction");
    expect(page).toContain("splitMissionIsHistory");
    expect(page).toContain("splitMissionMatchesFilter");
    expect(page).toContain("hiddenSplitBookingIds.has(card.id)");
  });

  it("derives visible status and service copy locally instead of trusting French server labels", () => {
    expect(page).toContain("formatKlyxBookingStatus(locale, booking.status)");
    expect(page).toContain("formatKlyxBookingService(locale, booking.serviceLabel)");
    expect(page).not.toContain("booking.statusLabel}");
    expect(page).not.toContain("nextAction.statusLabel");
    expect(page).not.toContain("nextBooking.statusLabel");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain('"fr-BE"');
  });

  it("keeps explicit provider, booking and payment confirmation boundaries translated", () => {
    expect(page).toContain('t("providerSafety")');
    expect(page).toContain('t("explicitConfirmationBoundary")');
    expect(dictionary).toContain("ne déclenche aucun paiement automatiquement");
    expect(dictionary).toContain("does not confirm any mission or trigger any payment automatically");
    expect(dictionary).toContain("expliciete bevestiging");
    expect(dictionary).toContain("ausdrückliche Bestätigung");
  });

  it("keeps the historical AI-first and grouped bookings markers", () => {
    expect(page).toContain("KLYX_AI_FIRST_BOOKINGS_15_02");
    expect(page).toContain("KLYX_GROUPED_BOOKINGS_PAGE_12_92");
    expect(page).toContain("KLYX_PROVIDER_MISSION_COCKPIT_13_79");
    expect(page).toContain("KLYX_CLIENT_MISSION_COCKPIT_13_80");
    expect(page).toContain("KLYX_SPLIT_MISSION_LIST_WIRING_13_21");
  });
});
