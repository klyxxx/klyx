import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const serverPage = read("app/onboarding/page.tsx");
const overview = read("app/onboarding/OnboardingOverview.tsx");
const i18n = read("lib/klyx-onboarding-overview-i18n.ts");

describe("KLYX onboarding overview page-i18n integration", () => {
  it("keeps authentication, profile resolution and first-profile setup on the server", () => {
    expect(serverPage).not.toContain('"use client"');
    expect(serverPage).toContain('from "@/lib/supabase/server"');
    expect(serverPage).toContain("await supabase.auth.getUser()");
    expect(serverPage).toMatch(/redirect\(\s*"\/login"\s*\)/);
    expect(serverPage).toContain("await getActiveProfile()");
    expect(serverPage).toContain("<FirstProfileSetup");
    expect(serverPage).toMatch(/metadata\.account_type\s*===\s*"provider"/);
    expect(serverPage).toMatch(/profile\.accountType\s*===\s*"provider"/);
    expect(serverPage).toContain("<OnboardingOverview provider={provider} firstName={firstName} />");
  });

  it("moves only the translated presentation to a locale-aware client component", () => {
    expect(overview).toContain('"use client"');
    expect(overview).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(overview).toContain("const { locale } = useKlyxLocale()");
    expect(overview).toContain("translateKlyxOnboardingOverview(locale, key)");
    expect(overview).toContain("formatKlyxOnboardingWelcome(locale, firstName)");
    expect(overview).toContain("<ProviderOnboardingProgress />");
  });

  it("preserves the role-specific destinations and product-boundary markers", () => {
    for (const marker of [
      "KLYX_ONBOARDING_REAL_WORKFLOWS_13_86",
      "KLYX_ROLE_NEXT_ACTION_14_03",
      "KLYX_AI_FIRST_ONBOARDING_15_04",
      "KLYX_ROLE_SAFETY_CONTEXT_14_03",
      "KLYX_PROVIDER_ONBOARDING_SHORTCUTS_13_86",
    ]) {
      expect(`${serverPage}\n${overview}`).toContain(marker);
    }

    for (const href of [
      "/dashboard",
      "/provider",
      "/provider/jobs",
      "/provider/assistant",
    ]) {
      expect(overview).toContain(`href="${href}"`);
    }

    for (const href of ["/assistant/market", "/profile", "/search"]) {
      expect(overview).toContain(`href: "${href}"`);
    }
    expect(overview).toContain("href={step.href}");
  });

  it("keeps overview coverage explicit and fail-closed", () => {
    expect(i18n).toContain(
      'KLYX_ONBOARDING_OVERVIEW_TRANSLATED_LOCALES = [\n  "fr",\n  "en",\n  "nl",\n  "de",\n]'
    );
    expect(i18n).toContain(': "fr"');
    expect(i18n).toContain("hasKlyxOnboardingOverviewTranslation");
  });
});
