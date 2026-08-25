import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX search page i18n contract", () => {
  it("keeps search strictly read-only", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("KLYX_SEARCH_PAGE_I18N");
    expect(page).toContain("KLYX_SEARCH_PAGE_READ_ONLY");
    expect(page).toContain('fetch("/api/services/public"');
    expect(page).toContain('`/api/search/providers?${queryString}`');
    expect(page).toContain('"/api/search/providers"');
    expect(page).toContain('cache: "no-store"');
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("preserves filter parsing and exact query parameter semantics", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain('params.get("start")');
    expect(page).toContain('params.get("time")');
    expect(page).toContain('params.set("service", draft.service)');
    expect(page).toContain('params.set("city", draft.city.trim())');
    expect(page).toContain('params.set("date", draft.date)');
    expect(page).toContain('params.set("start", draft.startTime)');
    expect(page).toContain('params.set("end", draft.endTime)');
    expect(page).toContain('params.set("budget", draft.budget)');
    expect(page).toContain('draft.pricing !== "all"');
    expect(page).toContain('params.set("pricing", draft.pricing)');
    expect(page).toContain('draft.sort !== "recommended"');
    expect(page).toContain('params.set("sort", draft.sort)');
    expect(page).toContain(
      'router.replace(nextQuery ? `/search?${nextQuery}` : "/search", {'
    );
  });

  it("preserves booking navigation without creating a booking", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain(
      "new URLSearchParams({ service: provider.serviceSlug })"
    );
    expect(page).toContain('params.set("date", filters.date)');
    expect(page).toContain('params.set("start", filters.startTime)');
    expect(page).toContain('params.set("end", filters.endTime)');
    expect(page).toContain(
      'return `/providers/${provider.profileId}/book?${params.toString()}`'
    );
  });

  it("keeps locale changes presentation-only for network requests", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("}, []);");
    expect(page).toContain("}, [queryString, reloadKey]);");
    expect(page).not.toContain("[queryString, reloadKey, locale]");
  });

  it("preserves comparison and recommendation algorithms", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("b.klyxScore - a.klyxScore");
    expect(page).toContain("provider.reviewCount > 0");
    expect(page).toContain(
      "b.rating - a.rating || b.reviewCount - a.reviewCount"
    );
    expect(page).toContain("provider.price !== null");
    expect(page).toContain("Number(a.price) - Number(b.price)");
    expect(page).toContain('appliedFilters.sort === "recommended"');
    expect(page).toContain("index === 0");
  });

  it("keeps provider-authored data verbatim and existing i18n subcomponents", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("provider.businessName");
    expect(page).toContain("provider.title || provider.headline ||");
    expect(page).toContain("provider.city || provider.serviceArea[0] ||");
    expect(page).toContain("provider.availabilitySummary");
    expect(page).toContain("provider.serviceLabel");
    expect(page).toContain("<MatchExplanation");
    expect(page).toContain("<SearchRecovery");
  });

  it("does not reflect raw backend or network errors", () => {
    const page = read("app/search/page.tsx");

    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("error.message");
  });
});
