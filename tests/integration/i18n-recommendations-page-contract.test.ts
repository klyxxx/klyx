import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX recommendations i18n contract", () => {
  it("keeps provider ranking strictly read-only", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("KLYX_RECOMMENDATIONS_PAGE_I18N");
    expect(page).toContain("KLYX_RECOMMENDATIONS_READ_ONLY");
    expect(page).toContain('requestParams.set("sort", "recommended")');
    expect(page).toContain('fetch(\n          `/api/search/providers?${requestParams.toString()}`');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("result.providers.slice(0, 3)");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("preserves profile and booking navigation semantics", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("service: provider.serviceSlug");
    expect(page).toContain('bookingParams.set("date", date)');
    expect(page).toContain('bookingParams.set("time", time)');
    expect(page).toContain('bookingParams.set("duration", duration)');
    expect(page).toContain("return `/providers/${provider.profileId}/book?${bookingParams.toString()}`");
    expect(page).toContain("return `/providers/${provider.profileId}`");
    expect(page).toContain("href={`/request/confirm?${queryString}`}");
    expect(page).toContain("href={`/search?${queryString}`}");
  });

  it("keeps provider-authored data verbatim", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("provider.businessName");
    expect(page).toContain("provider.firstName");
    expect(page).toContain("provider.lastName");
    expect(page).toContain("provider.title ||");
    expect(page).toContain("provider.serviceLabel");
    expect(page).toContain("provider.headline ||");
    expect(page).toContain("provider.city ||");
    expect(page).toContain("provider.availabilitySummary ||");
  });

  it("does not reflect raw backend or network errors", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("error.message");
  });
});
