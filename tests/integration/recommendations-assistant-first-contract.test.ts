import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX recommendations assistant-first contract", () => {
  it("keeps one dominant recommendation and secondary options collapsed", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("KLYX_RECOMMENDATIONS_ASSISTANT_FIRST_20260911");
    expect(page).toContain("const topProviders = result.providers.slice(0, 3)");
    expect(page).toContain("const primaryProvider = topProviders[0] ?? null");
    expect(page).toContain("const alternativeProviders = topProviders.slice(1, 3)");
    expect(page).toContain('data-testid="klyx-primary-recommendation"');
    expect(page).toContain('data-testid="klyx-secondary-options"');
    expect(page).toContain("<details");
    expect(page).toContain('t("whyRecommended")');
    expect(page).toContain('t("otherOptions")');

    expect(page).not.toContain("xl:grid-cols-5");
    expect(page).not.toContain("<Summary");
    expect(page).not.toContain("Medal");
  });

  it("compresses request context instead of rebuilding a marketplace filter grid", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain('data-testid="klyx-request-summary"');
    expect(page).toContain('t("city")');
    expect(page).toContain('t("date")');
    expect(page).toContain('t("time")');
    expect(page).toContain('t("budget")');
    expect(page).toContain("border-y border-border py-3");
  });

  it("preserves ranking, read-only search and booking/profile navigation", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain('requestParams.set("sort", "recommended")');
    expect(page).toContain('fetch(\n          `/api/search/providers?${requestParams.toString()}`');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("service: provider.serviceSlug");
    expect(page).toContain("return `/providers/${provider.profileId}/book?${bookingParams.toString()}`");
    expect(page).toContain("return `/providers/${provider.profileId}`");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("uses trust signals as explanation rather than a numeric marketplace scoreboard", () => {
    const page = read("app/recommendations/page.tsx");
    const i18n = read("lib/klyx-recommendations-page-i18n.ts");

    expect(page).toContain("formatKlyxRecommendationScore(locale, provider.klyxScore)");
    expect(page).toContain("provider.yearsExperience");
    expect(page).toContain("provider.completedJobs");
    expect(page).toContain("provider.city || t(\"areaToConfirm\")");
    expect(page).not.toContain('t("score")');

    expect(i18n).toContain('| "whyRecommended"');
    expect(i18n).toContain('| "otherOptions"');
    expect(i18n).toContain('| "chooseRecommendation"');
    expect(i18n).toContain('bestChoice: "Recommandation KLYX"');
  });
});
