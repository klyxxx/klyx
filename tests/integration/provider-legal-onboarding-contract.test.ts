import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const progress = fs.readFileSync(
  path.join(process.cwd(), "app/onboarding/ProviderOnboardingProgress.tsx"),
  "utf8"
);
const page = fs.readFileSync(
  path.join(process.cwd(), "app/provider/legal/page.tsx"),
  "utf8"
);
const copy = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-provider-legal-onboarding-i18n.ts"),
  "utf8"
);
const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/legal-authority/route.ts"),
  "utf8"
);

describe("KLYX provider legal onboarding authority", () => {
  it("uses the canonical legal authority as a required onboarding step", () => {
    expect(progress).toContain('fetch("/api/provider/legal-authority"');
    expect(progress).toContain('id: "legal"');
    expect(progress).toContain('href: "/provider/legal"');
    expect(progress).toContain('const legalDone = legalEligibility === "eligible"');
    expect(progress).toContain('required: true');
  });

  it("keeps conditional or unknown legal paths out of the completed state", () => {
    expect(progress).toContain('const legalStarted = legalPath !== "unknown"');
    expect(progress).toContain('? "done"');
    expect(progress).toContain('? "progress"');
    expect(progress).toContain(': "todo"');
    expect(progress).toContain('legalT("progressReview")');
    expect(progress).toContain('legalT("progressBlocked")');
  });

  it("lets the provider edit declarations but never server verification fields", () => {
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain("studentContext");
    expect(page).toContain("activityFrequency");
    expect(page).toContain("selfEmploymentCapacity");
    expect(page).toContain("enterpriseNumber");
    expect(page).toContain("socialInsuranceFundAffiliation");

    expect(page).not.toContain("enterpriseRegistrationVerification");
    expect(page).not.toContain("employmentArrangementVerification");
    expect(page).not.toContain("humanReviewStatus");
    expect(page).not.toContain("reviewedPath");

    expect(route).not.toContain("humanReviewStatus");
    expect(route).not.toContain("enterpriseRegistrationVerification");
  });

  it("does not present student context as a standalone legal status", () => {
    expect(copy).toContain(
      "Être étudiant est un contexte, pas un statut juridique suffisant."
    );
    expect(copy).toContain("student_independent");
    expect(copy).toContain("Étudiant-indépendant");
    expect(page).toContain('t("studentWarning")');
  });

  it("surfaces eligibility, missing data, reasons and human review from the authority", () => {
    expect(page).toContain("assessment.eligibility");
    expect(page).toContain("assessment.missingData");
    expect(page).toContain("assessment.reasons");
    expect(page).toContain("assessment.humanReviewRequired");
    expect(page).toContain("assessment.rulesetVersion");
  });

  it("does not couple the legal onboarding screen to Stripe", () => {
    expect(page).not.toMatch(/stripe/i);
    expect(copy).not.toMatch(/stripe/i);
  });
});
