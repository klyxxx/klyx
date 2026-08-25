import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const studioRoute = readFileSync(
  join(process.cwd(), "app/api/provider/studio/route.ts"),
  "utf8"
);

const qualificationPreflight = readFileSync(
  join(
    process.cwd(),
    "lib/provider-publication-qualification-readiness.ts"
  ),
  "utf8"
);

describe("provider studio qualification publication preflight contract", () => {
  it("runs qualification checks before the studio publish mutation", () => {
    const qualificationIndex = studioRoute.indexOf(
      "providerPublicationQualificationPreflight"
    );
    const corePutIndex = studioRoute.lastIndexOf("corePut(request)");

    expect(qualificationIndex).toBeGreaterThanOrEqual(0);
    expect(corePutIndex).toBeGreaterThan(qualificationIndex);
    expect(studioRoute).toContain("if (qualificationPreflight) return qualificationPreflight");
  });

  it("only gates actual publication attempts", () => {
    expect(qualificationPreflight).toContain(
      "if (body.publish !== true) return null"
    );
    expect(qualificationPreflight).toContain(
      "if (serviceIds.length === 0) return null"
    );
  });

  it("evaluates every enabled service against its country qualification rule", () => {
    expect(qualificationPreflight).toContain("for (const serviceId of serviceIds)");
    expect(qualificationPreflight).toContain("getSkillQualificationRule({");
    expect(qualificationPreflight).toContain("evaluateSkillEvidence({");
    expect(qualificationPreflight).toContain(
      "skillQualificationRequiresApproval(rule)"
    );
  });

  it("requires an approved KLYX verification when review is required", () => {
    expect(qualificationPreflight).toContain(
      'verification?.status === "approved"'
    );
    expect(qualificationPreflight).toContain(
      "if (!evaluation.ready || !approvalOk)"
    );
    expect(qualificationPreflight).toContain(
      'code: "KLYX_PROVIDER_SKILL_QUALIFICATION_REQUIRED"'
    );
  });

  it("does not count rejected documents as qualification proof", () => {
    expect(qualificationPreflight).toContain(
      'document.status !== "rejected"'
    );
  });
});
