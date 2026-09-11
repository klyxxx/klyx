import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX recommendations assistant-first contract", () => {
  it("shows at most three conversational proposals with one continuation action", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("KLYX_RECOMMENDATIONS_ASSISTANT_FIRST_20260911");
    expect(page).toContain("KLYX_CONVERSATIONAL_RESULT_20260911");
    expect(page).toContain("const topProviders = result.providers.slice(0, 3)");
    expect(page).toContain('data-testid="klyx-conversational-results"');
    expect(page).toContain('data-testid="klyx-provider-option"');
    expect(page).toContain('role="radiogroup"');
    expect(page).toContain('role="radio"');
    expect(page).toContain("selectedProviderId");
    expect(page).toContain('data-testid="klyx-continue-selected-provider"');

    expect(page).not.toContain('data-testid="klyx-primary-recommendation"');
    expect(page).not.toContain('data-testid="klyx-secondary-options"');
    expect(page).not.toContain("<details");
    expect(page).not.toContain("xl:grid-cols-5");
    expect(page).not.toContain("Medal");
  });

  it("keeps only the useful provider information in the conversational choice", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("providerDisplayName");
    expect(page).toContain("formatKlyxRecommendationScore(locale, provider.klyxScore)");
    expect(page).toContain("formatKlyxRecommendationPrice(");
    expect(page).toContain("provider.availabilitySummary || t(\"availabilityFallback\")");
    expect(page).toContain('t("whyRecommended")');
    expect(page).toContain("provider.yearsExperience");
    expect(page).toContain("provider.completedJobs");
    expect(page).toContain("provider.city || t(\"areaToConfirm\")");

    expect(page).not.toContain("profileHref");
    expect(page).not.toContain('t("viewProfile")');
  });

  it("compresses request context instead of rebuilding a marketplace filter grid", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain('data-testid="klyx-request-summary"');
    expect(page).toContain("displayedService");
    expect(page).toContain("city &&");
    expect(page).toContain("date &&");
    expect(page).toContain("time &&");
    expect(page).toContain("budget &&");
    expect(page).not.toContain("grid-cols-5");
  });

  it("preserves ranking, read-only search and the existing booking destination", () => {
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
});
