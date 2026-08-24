import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(file: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const matcher = readRepoFile("lib/catalog-service-matcher.ts");
const analyzer = readRepoFile(
  "app/api/requests/analyze/analyze-route-core.ts"
);
const qualification = readRepoFile(
  "lib/provider-public-qualification.ts"
);
const providerSearch = readRepoFile(
  "app/api/search/providers/providers-route-core.ts"
);
const providerTypes = readRepoFile("lib/provider-search.ts");
const matchUi = readRepoFile("app/search/MatchExplanation.tsx");
const matchI18n = readRepoFile("lib/klyx-match-explanation-i18n.ts");

describe("catalog ambiguity and provider qualification contract", () => {
  it("uses a bounded controlled synonym dictionary instead of a free-form fuzzy classifier", () => {
    expect(matcher).toContain("CONTROLLED_SERVICE_SYNONYMS");
    expect(matcher).toContain("controlledSynonymScore");
    expect(matcher).toContain("controlledRequestTermMatches");
    expect(matcher).toContain("serviceTerms");
    expect(matcher).toContain("requestTerms");
    expect(matcher).toContain("synonyme contrôlé KLYX");
    expect(matcher).not.toContain("levenshtein");
    expect(matcher).not.toContain("embedding");
  });

  it("requires a 12-point confidence lead before automatic service selection", () => {
    expect(matcher).toContain("CATALOG_SERVICE_MIN_CONFIDENCE = 60");
    expect(matcher).toContain("CATALOG_SERVICE_MIN_DECISION_GAP = 12");
    expect(matcher).toContain("resolveCatalogServiceDecision");
    expect(matcher).toContain("confidenceGap < CATALOG_SERVICE_MIN_DECISION_GAP");
    expect(matcher).toContain("selected: ambiguous ? null : top");

    expect(analyzer).toContain("resolveCatalogServiceDecision(candidates)");
    expect(analyzer).toContain("serviceAmbiguous");
    expect(analyzer).toContain("clarificationCandidates");
    expect(analyzer).toContain("serviceClarificationMessage");
    expect(analyzer).toContain("!serviceAmbiguous && missingFields.length === 0");
  });

  it("prevents remembered preferences from silently breaking a current ambiguity", () => {
    expect(analyzer).toContain("!serviceAmbiguous &&");
    expect(analyzer).toContain("preferredServiceSlug");
    expect(analyzer).toContain("memoryFields.push(\"preferred_service_slugs\")");
  });

  it("keeps provider qualification server-side and fail-closed across active countries", () => {
    expect(qualification).toContain('import "server-only"');
    expect(qualification).toContain('.from("skill_qualification_rules")');
    expect(qualification).toContain('.eq("enabled", true)');
    expect(qualification).toContain("RULE_PRIORITY");
    expect(qualification).toContain("regulated: 3");
    expect(qualification).toContain('rule?.rule_level ?? "evidence_required"');
    expect(qualification).toContain("candidatePriority > selectedPriority");
    expect(qualification).toContain("candidateNeedsOfficialRegistration");
    expect(qualification).toContain('selectedLevel ?? "evidence_required"');

    expect(providerSearch).toContain("getApprovedUserServiceIds");
    expect(providerSearch).toContain("approvedUserServiceIds.has(item.id)");
    expect(providerSearch).toContain("country_code");
    expect(providerSearch).toContain("loadPublicProviderQualifications");
  });

  it("exposes only a bounded public qualification summary, never private evidence", () => {
    for (const field of [
      "qualificationLevel",
      "qualificationApproved",
      "qualificationLabel",
      "officialRegistrationLabel",
    ]) {
      expect(providerTypes).toContain(field);
      expect(providerSearch).toContain(field);
    }

    for (const privateField of [
      "provider_statement",
      "review_note",
      "reviewed_by",
      "storage_path",
      "source_url",
      "required_proof_types",
      "accepted_proof_types",
    ]) {
      expect(providerSearch).not.toContain(privateField);
      expect(matchUi).not.toContain(privateField);
    }
  });

  it("does not present KLYX approval as an official public authorization", () => {
    expect(matchUi).toContain('t("qualificationTitle")');
    expect(matchUi).toContain('t("regulatedApprovedSummary")');
    expect(matchUi).toContain('t("officialRequirementPrefix")');
    expect(matchUi).toContain('t("qualificationDisclaimer")');
    expect(matchI18n).toContain("Contrôle de qualification métier");
    expect(matchI18n).toContain("Dossier métier réglementé approuvé");
    expect(matchI18n).toContain("Exigence réglementaire configurée");
    expect(matchI18n).toContain("ne remplace pas une autorisation");
    expect(matchI18n).toContain("registre officiel");
  });

  it("does not add transactional side effects to classification or qualification", () => {
    for (const source of [matcher, qualification]) {
      expect(source).not.toContain("create-checkout-session");
      expect(source).not.toContain('.from("bookings").insert');
      expect(source).not.toContain('.from("messages").insert');
      expect(source).not.toContain("stripe");
    }
  });
});
