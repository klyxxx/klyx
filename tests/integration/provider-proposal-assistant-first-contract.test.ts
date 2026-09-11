import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX selected provider assistant-first contract", () => {
  it("keeps one primary service visible and collapses secondary choices", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain("KLYX_PROVIDER_PROPOSAL_ASSISTANT_FIRST_20260911");
    expect(page).toContain("const primaryService = services[0] ?? null");
    expect(page).toContain("const otherServices = services.slice(1)");
    expect(page).toContain('data-testid="klyx-provider-proposal"');
    expect(page).toContain('data-testid="klyx-primary-provider-service"');
    expect(page).toContain('data-testid="klyx-other-provider-services"');
    expect(page).toContain("<details");
    expect(page).toContain('t("otherServices")');
  });

  it("uses assistant trust signals instead of a numeric marketplace scoreboard", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain('data-testid="klyx-provider-assistant-summary"');
    expect(page).toContain('t("assistantChoice")');
    expect(page).toContain("formatKlyxPublicProviderScoreLabel(locale, bestScore)");
    expect(page).toContain("formatKlyxPublicProviderCompletedJobs(locale, completedJobs)");
    expect(page).not.toContain("{bestScore.toFixed(0)}");
    expect(page).not.toContain("service.klyxScore.toFixed(0)");
    expect(page).not.toContain("violet-");
  });

  it("progressively discloses gallery and review evidence while preserving trust plumbing", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain('data-testid="klyx-provider-trust-details"');
    expect(page).toContain('t("trustDetails")');
    expect(page).toContain("<PublicReviews");
    expect(page).toContain("klyxScore={bestScore}");
    expect(page).toContain('providerProfile.verification_status === "verified"');
    expect(page).toContain("yearsExperience={Number(");
    expect(page).toContain('t("galleryTitle")');
  });

  it("preserves provider reads and quote / booking navigation", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain('.from("profiles")');
    expect(page).toContain('.from("provider_profiles")');
    expect(page).toContain('.from("user_services")');
    expect(page).toContain('.from("service_profiles")');
    expect(page).toContain('.from("availability_slots")');
    expect(page).toContain('fetch(`/api/providers/${providerId}/verified-services`');
    expect(page).toContain("/quote?service=${encodeURIComponent(");
    expect(page).toContain("/book?service=${encodeURIComponent(");
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".upsert(");
    expect(page).not.toContain(".delete(");
  });

  it("keeps assistant-first copy complete in every certified language", () => {
    const i18n = read("lib/klyx-public-provider-i18n.ts");

    expect(i18n).toContain('"assistantChoice"');
    expect(i18n).toContain('"otherServices"');
    expect(i18n).toContain('"trustDetails"');
    expect(i18n).toContain('assistantChoice: "Pourquoi KLYX le recommande"');
    expect(i18n).toContain('assistantChoice: "Why KLYX recommends this provider"');
    expect(i18n).toContain('assistantChoice: "Warum KLYX diesen Anbieter empfiehlt"');
  });
});
