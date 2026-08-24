import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX founder analytics i18n contract", () => {
  it("localizes analytics presentation and keeps aggregate values", () => {
    const page = read("app/founder/analytics/page.tsx");
    expect(page).toContain("KLYX_FOUNDER_ANALYTICS_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("data.metrics.newClientProfiles");
    expect(page).toContain("data.metrics.searchesWithResults");
    expect(page).toContain("data.metrics.quotesAccepted");
    expect(page).toContain("data.metrics.completedBookings");
    expect(page).toContain("data.ratios.bookingPerQuoteVolume");
  });

  it("preserves GET-only no-store loading and selectable windows", () => {
    const page = read("app/founder/analytics/page.tsx");
    const route = read("app/api/founder/analytics/route.ts");
    expect(page).toContain("`/api/founder/analytics?days=${days}`");
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("new AbortController()");
    expect(page).toContain("controller.abort()");
    expect(page).toContain("onClick={() => setDays(windowDays)}");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(route).toContain("export async function GET(request: Request)");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("does not reflect backend error or server-authored explanatory copy", () => {
    const page = read("app/founder/analytics/page.tsx");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("caught.message");
    expect(page).not.toContain("instanceof Error");
    expect(page).not.toContain("data.privacy.note");
    expect(page).not.toContain("data.interpretation");
  });

  it("preserves analytics privacy and aggregation server contract", () => {
    const route = read("app/api/founder/analytics/route.ts");
    expect(route).toContain("aggregateOnly: true");
    expect(route).toContain("storesUserIdentifiers: false");
    expect(route).toContain("storesSearchText: false");
    expect(route).toContain("storesLocation: false");
    expect(route).toContain("storesIpAddress: false");
    expect(route).toContain("const ALLOWED_WINDOWS = new Set([7, 30, 90])");
  });
});
