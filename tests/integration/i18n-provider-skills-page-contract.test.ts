import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const page = readRepoFile("app/provider/skills/page.tsx");
const panel = readRepoFile("app/provider/skills/SkillRequirementsPanel.tsx");
const verificationRoute = readRepoFile(
  "app/api/provider/skills-verification/route.ts"
);
const requirementsRoute = readRepoFile(
  "app/api/provider/skill-requirements/route.ts"
);
const i18n = readRepoFile("lib/klyx-provider-skills-i18n.ts");

describe("KLYX provider skills i18n contract", () => {
  it("uses the shared locale provider with explicit French fallback", () => {
    expect(page).toContain("useKlyxLocale");
    expect(panel).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderSkillStatus");
    expect(panel).toContain("translateKlyxProviderSkillProofType");
    expect(i18n).toContain('return LOCALE_SET.has(locale) ? (locale as KlyxProviderSkillsLocale) : "fr"');
  });

  it("preserves the authenticated GET and provider-owned verification boundary", () => {
    expect(page).toContain('fetch("/api/provider/skills-verification"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${accessToken}`");
    expect(verificationRoute).toContain('requireAccountType(result.profile, "provider")');
    expect(verificationRoute).toContain('.eq("user_id", profileId)');
    expect(verificationRoute).toContain('.eq("profile_id", profile.id)');
  });

  it("keeps the private evidence upload boundary, size/MIME limits and failed-registration rollback", () => {
    expect(page).toContain("file.size > 10 * 1024 * 1024");
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]) {
      expect(page).toContain(`"${mime}"`);
      expect(verificationRoute).toContain(`"${mime}"`);
    }
    expect(page).toContain('.from("provider-verification")');
    expect(page).toContain(".upload(path, file, {");
    expect(page).toContain('cacheControl: "3600"');
    expect(page).toContain("upsert: false");
    expect(page).toContain('accept=".pdf,.jpg,.jpeg,.png,.webp"');
    expect(page).toContain('.remove([path])');
    expect(verificationRoute).toContain("sizeBytes > 10 * 1024 * 1024");
    expect(verificationRoute).toContain("storagePath.startsWith(expectedPrefix)");
  });

  it("preserves the exact explicit POST evidence registration payload", () => {
    expect(page).toContain('method: "POST"');
    expect(page).toContain("userServiceId: skill.userServiceId");
    expect(page).toContain('proofTypes[skill.userServiceId] ?? "training_certificate"');
    expect(page).toContain("storagePath: path");
    expect(page).toContain("originalName: file.name");
    expect(page).toContain("mimeType: file.type");
    expect(page).toContain("sizeBytes: file.size");
    expect(verificationRoute).toContain('.from("provider_skill_documents")');
    expect(verificationRoute).toContain('status: "uploaded"');
  });

  it("preserves the exact explicit PATCH save/submit payload and server limits", () => {
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain("providerStatement: statements[skill.userServiceId] ?? \"\"");
    expect(page).toContain("yearsExperience: years[skill.userServiceId] ?? 0");
    expect(page).toContain("submit,");
    expect(page).toContain("min={0}");
    expect(page).toContain("max={80}");
    expect(verificationRoute).toContain("body.providerStatement?.trim().slice(0, 1200)");
    expect(verificationRoute).toContain("!Number.isInteger(years)");
    expect(verificationRoute).toContain("years < 0");
    expect(verificationRoute).toContain("years > 80");
    expect(verificationRoute).toContain("statement.length < 30");
  });

  it("keeps locked dossier states and submit readiness enforced in UI and server", () => {
    expect(page).toContain('["submitted", "under_review", "approved"].includes');
    expect(page).toContain("requirementsReady[skill.userServiceId] !== true");
    expect(panel).toContain("body.evaluation?.ready === true");
    expect(verificationRoute).toContain('["submitted", "under_review", "approved"].includes');
    expect(verificationRoute).toContain("evaluateSkillEvidence({");
    expect(verificationRoute).toContain("if (!evaluation.identityOk)");
    expect(verificationRoute).toContain("if (!evaluation.experienceOk)");
    expect(verificationRoute).toContain("evaluation.missingProofTypes.length > 0");
  });

  it("keeps qualification requirements read-only and provider-owned", () => {
    expect(panel).toContain("/api/provider/skill-requirements?userServiceId=");
    expect(panel).toContain('cache: "no-store"');
    expect(requirementsRoute).toContain('requireAccountType(profile, "provider")');
    expect(requirementsRoute).toContain('.eq("user_id", profile.id)');
    expect(requirementsRoute).toContain("getSkillQualificationRule({");
    expect(requirementsRoute).toContain("evaluateSkillEvidence({");
    expect(requirementsRoute).not.toContain("export async function POST");
    expect(requirementsRoute).not.toContain("export async function PATCH");
    expect(requirementsRoute).not.toContain("export async function DELETE");
  });

  it("keeps provider/server-authored evidence verbatim while localizing controlled identifiers", () => {
    expect(page).toContain("{skill.serviceName}");
    expect(page).toContain("{verification.review_note}");
    expect(page).toContain("{document.original_name}");
    expect(page).toContain("translateKlyxProviderSkillProofType(");
    expect(page).toContain("translateKlyxProviderSkillDocumentStatus(");
    expect(panel).toContain("rule.officialRegistrationLabel ||");
    expect(panel).toContain("{rule.legalNote}");
  });

  it("does not reflect raw backend/storage errors in localized presentation", () => {
    expect(page).toContain('setError(t("loadError"))');
    expect(page).toContain('setError(t("uploadError"))');
    expect(page).toContain('setError(t("saveError"))');
    expect(panel).toContain("setError(true)");
    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("uploadError.message");
    expect(panel).not.toContain("body.error ||");
    expect(panel).not.toContain("e.message");
  });

  it("does not add booking, payment, refund or transfer execution", () => {
    for (const source of [page, panel]) {
      for (const forbidden of [
        "create-checkout-session",
        "payment_intent",
        "refund",
        "transfer",
        'fetch("/api/bookings',
      ]) {
        expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});
