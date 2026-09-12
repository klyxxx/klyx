import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX selected provider assistant-first contract", () => {
  it("continues the KLYX thread with the selected provider and one primary action", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain("KLYX_PROVIDER_DIRECT_THREAD_CONTINUATION_20260912");
    expect(page).toContain('data-testid="klyx-provider-proposal"');
    expect(page).toContain('data-testid="klyx-provider-thread-continuation"');
    expect(page).toContain('t("confidenceLabel")');
    expect(page).toContain('t("priceLabel")');
    expect(page).toContain('t("availabilityLabel")');
    expect(page).toContain('data-testid="klyx-provider-assistant-summary"');
    expect(page).toContain('t("assistantChoice")');

    const primaryActions =
      page.match(/data-testid="klyx-provider-primary-action"/g) ?? [];
    expect(primaryActions).toHaveLength(1);
    expect(page).toContain("/book?service=${encodeURIComponent(");
    expect(page).not.toContain("/quote?service=${encodeURIComponent(");
  });

  it("keeps the visible proposal conversational instead of a marketplace scoreboard", () => {
    const page = read("app/providers/[id]/page.tsx");
    const reviews = read("app/providers/[id]/PublicReviews.tsx");

    expect(page).toContain("formatKlyxPublicProviderScoreLabel(locale, bestScore)");
    expect(page).toContain("formatKlyxPublicProviderPrice(");
    expect(page).toContain("formatKlyxPublicProviderAvailability(");
    expect(page).toContain("formatKlyxPublicProviderCompletedJobs(locale, completedJobs)");
    expect(page).not.toContain("{bestScore.toFixed(0)}");
    expect(page).not.toContain("service.klyxScore.toFixed(0)");
    expect(page).not.toContain("/100");
    expect(page).not.toContain("violet-");
    expect(reviews).not.toContain("klyxScore");
    expect(reviews).not.toContain("/100");
    expect(reviews).not.toContain("violet-");
  });

  it("keeps secondary evidence available without turning it into the primary flow", () => {
    const page = read("app/providers/[id]/page.tsx");
    const reviews = read("app/providers/[id]/PublicReviews.tsx");

    expect(page).toContain("const primaryService = services[0] ?? null");
    expect(page).toContain("const otherServices = services.slice(1)");
    expect(page).toContain('data-testid="klyx-other-provider-services"');
    expect(page).toContain('data-testid="klyx-provider-trust-details"');
    expect(page).toContain("<PublicReviews providerId={profile.id} />");
    expect(page).toContain('t("galleryTitle")');
    expect(reviews).toContain('fetch(`/api/providers/${providerId}/reviews`');
    expect(reviews).toContain('data-testid="klyx-public-reviews"');
  });

  it("preserves verified provider reads and booking business plumbing", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain('.from("profiles")');
    expect(page).toContain('.from("provider_profiles")');
    expect(page).toContain('.from("user_services")');
    expect(page).toContain('.from("service_profiles")');
    expect(page).toContain('.from("availability_slots")');
    expect(page).toContain('fetch(`/api/providers/${providerId}/verified-services`');
    expect(page).toContain("approvedUserServiceIds.has(item.id)");
    expect(page).toContain(".sort((a, b) => b.klyxScore - a.klyxScore)");
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".upsert(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("refund");
  });

  it("moves public provider pages and booking onto MissionRail while preserving Founder/Admin legacy isolation", () => {
    const shell = read("app/ui/AssistantShell.tsx");

    expect(shell).toContain('"/founder"');
    expect(shell).toContain('"/admin"');
    expect(shell).toContain('"/recommendations"');
    expect(shell).not.toContain('  "/providers",');
    expect(shell).toContain("return <AppSidebar />;");
    expect(shell).toContain("<MissionRail");
  });

  it("keeps assistant-first copy complete in every certified language", () => {
    const i18n = read("lib/klyx-public-provider-i18n.ts");

    expect(i18n).toContain('"assistantChoice"');
    expect(i18n).toContain('"confidenceLabel"');
    expect(i18n).toContain('"priceLabel"');
    expect(i18n).toContain('"availabilityLabel"');
    expect(i18n).toContain('assistantChoice: "Pourquoi KLYX le recommande"');
    expect(i18n).toContain('assistantChoice: "Why KLYX recommends this provider"');
    expect(i18n).toContain('assistantChoice: "Warum KLYX diesen Anbieter empfiehlt"');
  });
});
