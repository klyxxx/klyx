import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skillQualification = readFileSync(
  join(process.cwd(), "lib/skill-qualification.ts"),
  "utf8"
);

const publicQualification = readFileSync(
  join(process.cwd(), "lib/provider-public-qualification.ts"),
  "utf8"
);

function fallbackBlock(source: string) {
  const start = source.indexOf("if (!data) {");
  const end = source.indexOf("\n  return {", start + 1);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe("skill qualification self-declared default contract", () => {
  it("does not invent documentary requirements when no explicit rule exists", () => {
    const fallback = fallbackBlock(skillQualification);

    expect(fallback).toContain('ruleLevel: "self_declared"');
    expect(fallback).toContain("requiredProofTypes: []");
    expect(fallback).toContain("minimumYearsExperience: 0");
    expect(fallback).toContain("identityRequired: false");
    expect(fallback).toContain("insuranceRequired: false");
    expect(fallback).toContain("officialRegistrationRequired: false");
    expect(fallback).not.toContain('ruleLevel: "evidence_required"');
  });

  it("keeps explicit database qualification rules authoritative", () => {
    expect(skillQualification).toContain("ruleLevel: data.rule_level");
    expect(skillQualification).toContain(
      "requiredProofTypes: (data.required_proof_types ?? []) as SkillProofType[]"
    );
    expect(skillQualification).toContain(
      "identityRequired: data.identity_required !== false"
    );
    expect(skillQualification).toContain(
      "officialRegistrationRequired: data.official_registration_required === true"
    );
    expect(skillQualification).toContain('.eq("enabled", true)');
  });

  it("uses self declaration for missing public rules without weakening stricter explicit countries", () => {
    expect(publicQualification).toContain("self_declared: 1");
    expect(publicQualification).toContain("evidence_required: 2");
    expect(publicQualification).toContain("regulated: 3");
    expect(publicQualification).toContain(
      'rule?.rule_level ?? "self_declared"'
    );
    expect(publicQualification).toContain(
      'selectedLevel ?? "self_declared"'
    );
    expect(publicQualification).not.toContain(
      'rule?.rule_level ?? "evidence_required"'
    );
  });

  it("keeps provider verification approval separate from qualification evidence", () => {
    expect(publicQualification).toContain("approved: true");
    expect(publicQualification).toContain(
      'return "Déclaration métier approuvée par KLYX"'
    );
    expect(publicQualification).not.toMatch(/provider_skill_documents/);
  });
});
