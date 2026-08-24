import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX match explanation i18n contract", () => {
  it("uses the shared locale for matching labels and explanations", () => {
    const component = read("app/search/MatchExplanation.tsx");

    expect(component).toContain("KLYX_MATCH_EXPLANATION_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain("explainProviderMatch(provider, filters, locale)");
    expect(component).toContain("matchingLevelLabel(adjustedLevel, locale)");
    expect(component).not.toContain("Dossier métier réglementé approuvé");
    expect(component).not.toContain("Le score explique une compatibilité");
  });

  it("preserves the authenticated no-store provider coverage GET", () => {
    const component = read("app/search/MatchExplanation.tsx");

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain("/api/search/provider-coverage?");
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(component).not.toContain('method: "POST"');
    expect(component).not.toContain('method: "PATCH"');
    expect(component).not.toContain('method: "DELETE"');
  });

  it("keeps coverage scoring adjustments and matching thresholds exact", () => {
    const component = read("app/search/MatchExplanation.tsx");
    const matching = read("lib/intelligent-matching.ts");

    expect(component).toContain("explanation.score + 8");
    expect(component).toContain("explanation.score - 20");
    expect(component).toContain("adjustedScore >= 90");
    expect(component).toContain("adjustedScore >= 75");
    expect(component).toContain("adjustedScore >= 55");
    expect(matching).toContain("score += filters.city ? 20 : 10");
    expect(matching).toContain("score += 25");
    expect(matching).toContain("score += filters.budget ? 20 : 10");
    expect(matching).toContain("* 0.2");
    expect(matching).toContain("score += 10");
    expect(matching).toContain("score += 8");
    expect(matching).toContain("score += 7");
    expect(matching).toContain("score += 5");
    expect(matching).toContain("reasons: reasons.slice(0, 5)");
    expect(matching).toContain("warnings: warnings.slice(0, 3)");
  });

  it("keeps existing APIs backward compatible and QuoteRequest isolated", () => {
    const component = read("app/search/MatchExplanation.tsx");
    const matching = read("lib/intelligent-matching.ts");

    expect(matching).toContain('locale: KlyxLocale = "fr"');
    expect(component).toContain("<QuoteRequestButton provider={provider} filters={filters} />");
    expect(component).not.toContain("quote-request");
    expect(component).not.toContain("stripe");
    expect(component).not.toContain("payment_intent");
  });

  it("builds localized coverage copy from structured fields instead of reflecting API text", () => {
    const component = read("app/search/MatchExplanation.tsx");

    expect(component).toContain("formatKlyxCoverageMessage");
    expect(component).toContain("requestedLocality: coverage.requestedLocality ?? locality");
    expect(component).toContain("zoneLocality: coverage.zoneLocality ?? \"\"");
    expect(component).not.toContain("coverage.message");
    expect(component).not.toContain("body.error");
  });
});
