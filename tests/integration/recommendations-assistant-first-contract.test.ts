import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX recommendations assistant-first contract", () => {
  it("keeps recommendation results conversational and limited to three choices", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("KLYX_RECOMMENDATIONS_ASSISTANT_FIRST_20260911");
    expect(page).toContain("KLYX_RECOMMENDATIONS_CONVERSATIONAL_RESULT_20260911");
    expect(page).toContain("const topProviders = result.providers.slice(0, 3)");
    expect(page).toContain("klyx-primary-recommendation");
    expect(page).toContain('data-testid="klyx-secondary-options"');
    expect(page).toContain('t("whyRecommended")');

    expect(page).not.toContain("<details");
    expect(page).not.toContain("xl:grid-cols-5");
    expect(page).not.toContain("<Summary");
    expect(page).not.toContain("Medal");
    expect(page).not.toContain('t("viewProfile")');
  });

  it("compresses request context into a user-style message instead of a filter grid", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain('data-testid="klyx-request-summary"');
    expect(page).toContain("flex justify-end");
    expect(page).toContain("rounded-3xl bg-muted");
    expect(page).toContain("max-w-3xl");
    expect(page).not.toContain("grid-cols-5");
  });

  it("preserves ranking, read-only search and canonical booking navigation", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain('requestParams.set("sort", "recommended")');
    expect(page).toContain('fetch(\n          `/api/search/providers?${requestParams.toString()}`');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("service: provider.serviceSlug");
    expect(page).toContain("return `/providers/${provider.profileId}/book?${bookingParams.toString()}`");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("shows only the essential decision information before selection", () => {
    const page = read("app/recommendations/page.tsx");
    const i18n = read("lib/klyx-recommendations-page-i18n.ts");

    expect(page).toContain("formatKlyxRecommendationScore(locale, provider.klyxScore)");
    expect(page).toContain("provider.completedJobs");
    expect(page).toContain("provider.availabilitySummary");
    expect(page).toContain("formatKlyxRecommendationPrice(");
    expect(page).not.toContain("formatKlyxRecommendationExperience");
    expect(page).not.toContain("provider.avatarUrl");
    expect(page).not.toContain('t("score")');

    expect(i18n).toContain('| "whyRecommended"');
    expect(i18n).toContain('| "chooseRecommendation"');
  });
});
