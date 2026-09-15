import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const serverPage = read("app/onboarding/page.tsx");
const firstProfile = read("app/onboarding/FirstProfileSetup.tsx");

describe("KLYX roleless onboarding integration", () => {
  it("keeps authentication and first-profile creation on the existing secure boundary", () => {
    expect(serverPage).not.toContain('"use client"');
    expect(serverPage).toContain('from "@/lib/supabase/server"');
    expect(serverPage).toContain("await supabase.auth.getUser()");
    expect(serverPage).toMatch(/redirect\(\s*"\/login"\s*\)/);
    expect(serverPage).toContain("await getActiveProfile()");
    expect(serverPage).toContain("<FirstProfileSetup");
  });

  it("sends every completed account to the same assistant shell", () => {
    expect(serverPage).toMatch(/if \(profile\)[\s\S]*redirect\("\/assistant"\)/);
    expect(serverPage).not.toContain("profile.accountType");
    expect(serverPage).not.toContain("OnboardingOverview");
    expect(firstProfile).toContain('router.replace("/assistant")');
  });

  it("does not ask for a permanent client/provider role", () => {
    expect(firstProfile).not.toContain("setAccountType");
    expect(firstProfile).not.toContain("roleChoiceUnlocked");
    expect(firstProfile).not.toContain("providerSelected");
    expect(firstProfile).not.toContain("clientSelected");
    expect(firstProfile).toContain('accountType: "client"');
    expect(firstProfile).toContain("Transitional schema value only");
  });

  it("keeps identity and market information required before entering KLYX", () => {
    expect(firstProfile).toContain('t("identityRequired")');
    expect(firstProfile).toContain('t("marketRequired")');
    expect(firstProfile).toContain("KLYX_SUPPORTED_MARKETS");
    expect(firstProfile).toContain('fetch("/api/profiles/manage"');
  });
});
