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

const page = read("app/bookings/page.tsx");
const overview = read("app/api/bookings/overview/route.ts");
const dictionary = read("lib/klyx-bookings-page-i18n.ts");
const serviceDictionary = read("lib/klyx-bookings-service-i18n.ts");

describe("KLYX bookings overview i18n contract", () => {
  it("keeps the bookings page read-only and on the historical GET boundaries", () => {
    expect(page).toContain('fetch("/api/bookings/overview"');
    expect(page).toContain('fetch("/api/bookings/split-missions"');
    expect(page).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
    expect(page).not.toContain("supabase.from(");
    expect(page).not.toContain("supabaseAdmin");
  });

  it("keeps booking classification and navigation semantics unchanged", () => {
    expect(page).toContain("booking.actionRequired");
    expect(page).toContain("!booking.history");
    expect(page).toContain("booking.history");
    expect(page).toContain("splitMissionNeedsAction");
    expect(page).toContain("splitMissionIsHistory");
    expect(page).toContain("splitMissionMatchesFilter");
    expect(page).toContain('href="/provider/jobs"');
    expect(page).toContain('href="/provider/assistant"');
    expect(page).toContain('href="/assistant/market"');
    expect(page).toContain('href="/search"');
  });

  it("uses locale-driven presentation instead of server French labels", () => {
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("formatKlyxBookingStatus(locale, booking.status)");
    expect(page).toContain("formatKlyxBookingServiceFromSlug");
    expect(page).not.toContain("body.error");
    expect(dictionary).toContain('"fr"');
    expect(dictionary).toContain('"en"');
    expect(dictionary).toContain('"nl"');
    expect(dictionary).toContain('"de"');
    expect(serviceDictionary).toContain("SERVICE_SLUG_ALIASES");
  });

  it("exposes stable service slugs without changing overview writes or queries", () => {
    expect(overview).toMatch(/serviceSlug:\s*\|\s*string\s*\|\s*null/);
    expect(overview.match(/serviceSlug:\s*service\?\.slug\s*\?\?\s*null/g)?.length).toBe(2);
    expect(overview).toContain('.from("bookings")');
    expect(overview).toContain('.from(\n            "booking_groups"\n          )');
    expect(overview).toContain('.from("profiles")');
    expect(overview).toContain('.from("services")');
    expect(overview).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
  });

  it("keeps explicit booking and payment confirmation boundaries translated", () => {
    expect(page).toContain('t("providerSafety")');
    expect(page).toContain('t("explicitConfirmationBoundary")');
    expect(dictionary).toContain("une confirmation explicite reste nécessaire");
    expect(dictionary).toContain("explicit confirmation is still required");
    expect(dictionary).toContain("expliciete bevestiging blijft vereist");
    expect(dictionary).toContain("ausdrückliche Bestätigung erforderlich");
  });
});
