import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicationSource = readFileSync(
  join(process.cwd(), "lib/provider-skill-publication.ts"),
  "utf8"
);
const verifiedServicesRoute = readFileSync(
  join(
    process.cwd(),
    "app/api/providers/[id]/verified-services/route.ts"
  ),
  "utf8"
);
const providerSearchSource = readFileSync(
  join(
    process.cwd(),
    "app/api/search/providers/providers-route-core.ts"
  ),
  "utf8"
);
const publicQualificationSource = readFileSync(
  join(process.cwd(), "lib/provider-public-qualification.ts"),
  "utf8"
);
const providerPage = readFileSync(
  join(process.cwd(), "app/providers/[id]/page.tsx"),
  "utf8"
);

describe("provider public skill eligibility contract", () => {
  it("re-evaluates public eligibility from the current rule and evidence", () => {
    expect(publicationSource).toContain(
      "getPublicUserServiceQualificationIdsForProfiles"
    );
    expect(publicationSource).toContain("getSkillQualificationRule(request)");
    expect(publicationSource).toContain("evaluateSkillPublicEligibility({");
    expect(publicationSource).toContain(
      '.from("provider_skill_documents")'
    );
    expect(publicationSource).toContain(
      'document.status !== "rejected"'
    );
    expect(publicationSource).toContain("identity_status");
    expect(publicationSource).toContain("verification?.status ?? null");
  });

  it("preserves the legacy public response field while separating real KLYX approvals", () => {
    expect(verifiedServicesRoute).toContain(
      "getPublicUserServiceQualificationIds({"
    );
    expect(verifiedServicesRoute).toContain(
      "userServiceIds: Array.from(eligibility.eligibleUserServiceIds)"
    );
    expect(verifiedServicesRoute).toContain("approvedUserServiceIds: Array.from(");
    expect(verifiedServicesRoute).toContain(
      "eligibility.approvedUserServiceIds"
    );
  });

  it("uses the same live eligibility and approval split in provider search", () => {
    expect(providerSearchSource).toContain(
      "getPublicUserServiceQualificationIdsForProfiles({"
    );
    expect(providerSearchSource).toContain(
      "qualificationIds.eligibleUserServiceIds.has(item.id)"
    );
    expect(providerSearchSource).toContain(
      "const approvedUserServiceIds = qualificationIds.approvedUserServiceIds"
    );
    expect(providerSearchSource).toContain("approvedUserServiceIds,");
    expect(providerSearchSource).not.toContain(
      "await getApprovedUserServiceIds("
    );
  });

  it("keeps the provider detail page compatible with public-eligible userServiceIds", () => {
    expect(providerPage).toContain("verifiedServicesBody.userServiceIds ?? []");
    expect(providerPage).toContain(
      ".filter(\n          (item) => approvedUserServiceIds.has(item.id)\n        )"
    );
  });

  it("never labels self-declared work as approved by KLYX", () => {
    expect(publicQualificationSource).not.toContain("approved: true");
    expect(publicQualificationSource).not.toContain(
      "Déclaration métier approuvée par KLYX"
    );
    expect(publicQualificationSource).toContain(
      "Compétence déclarée par le prestataire"
    );
    expect(publicQualificationSource).toContain(
      "approvedUserServiceIds?: ReadonlySet<string>"
    );
  });
});
