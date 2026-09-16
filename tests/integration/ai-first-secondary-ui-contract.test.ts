import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KLYX_AI_FIRST_SECONDARY_UI_CONTRACT_15_04
function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX AI-first secondary UI", () => {
  it("keeps secondary flows compact without removing security information", () => {
    const onboarding = read("app/onboarding/page.tsx");
    const assistant = read("app/components/assistant/AssistantThread.tsx");
    const composer = read("app/components/assistant/AssistantComposer.tsx");
    const legacyProviderAssistant = read("app/provider/assistant/page.tsx");
    const jobs = read("app/provider/jobs/page.tsx");
    const jobsI18n = read("lib/klyx-provider-jobs-i18n.ts");
    const finance = read("app/provider/payments/page.tsx");
    const verification = read("app/provider/verification/page.tsx");
    const verificationI18n = read("lib/klyx-provider-verification-i18n.ts");
    const privacy = read("app/settings/PhonePrivacyControls.tsx");
    const privacyI18n = read("lib/klyx-phone-privacy-i18n.ts");
    const history = read("app/settings/PhoneAccessHistory.tsx");
    const historyI18n = read("lib/klyx-phone-history-i18n.ts");

    expect(onboarding).toContain("KLYX_AI_FIRST_ONBOARDING_15_04");
    expect(legacyProviderAssistant).toContain('redirect("/assistant")');
    expect(assistant).toContain('fetch("/api/brain/converse"');
    expect(assistant).toContain("LEGACY_CONFIRMATION_BOUNDARY");
    expect(composer).toContain("placeholder={placeholder}");
    expect(composer).toContain("#2563EB");

    expect(jobs).toContain("recommendedRequest");
    expect(jobs).toContain('t("offerNotBookingPayment")');
    expect(jobsI18n).toContain(
      "Tous les créneaux doivent être couverts. Une offre = mission complète."
    );

    expect(finance).toContain("KLYX_PROVIDER_FINANCE_DESTINATION_2026_09_02");
    expect(finance).toContain("Ton argent, sans détour.");
    expect(finance).toContain("Détails du compte de paiement");
    expect(finance).toContain("FinanceReconciliationStatus");
    expect(finance).toContain("FinanceExportButton");
    expect(finance).toContain("ProviderFinanceAudit");

    expect(verification).toContain('t("privacyTitle")');
    expect(verificationI18n).toContain("Documents privés et sensibles");
    expect(privacy).toContain("KLYX_PHONE_PRIVACY_UI_12_75");
    expect(privacy).toContain('t("title")');
    expect(privacyI18n).toContain('title: "Confidentialité du téléphone"');
    expect(history).toContain("KLYX_PHONE_ACCESS_HISTORY_UI_12_76");
    expect(history).toContain('t("privacyNote")');
    expect(historyI18n).toContain(
      "Aucun numéro de téléphone ni code SMS OTP n’y apparaît."
    );

    expect(onboarding).not.toContain(
      "Ton profil et tes services restent sous ton contrôle."
    );
    expect(assistant).not.toContain('fetch("/api/provider/assistant"');
  });
});
