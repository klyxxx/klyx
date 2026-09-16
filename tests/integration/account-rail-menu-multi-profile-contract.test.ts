import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const menu = read("app/components/AccountSwitcher.tsx");
const accountSwitcher = read("lib/account-switcher.ts");
const shell = read("app/ui/AssistantShell.tsx");
const rail = read("app/ui/MissionRail.tsx");

describe("KLYX roleless rail account menu contract", () => {
  it("keeps the legacy switcher implementation available only for compatibility", () => {
    expect(menu).toContain("getProfiles");
    expect(accountSwitcher).toContain('fetch("/api/profiles/active", {');
    expect(accountSwitcher).toContain("KLYX_ACTIVE_PROFILE_CHANGED");

    expect(shell).not.toContain("AccountSwitcher");
    expect(shell).not.toContain("KLYX_ACTIVE_PROFILE_CHANGED");
    expect(rail).not.toContain("AccountSwitcher");
    expect(rail).not.toContain("switchAccount");
  });

  it("keeps one account entry directly inside MissionRail", () => {
    expect(shell).not.toContain('data-testid="assistant-shell-account-slot"');
    expect(rail).toContain('data-testid="account-entry"');
    expect(rail).toContain('href: "/profile"');
    expect(rail).toContain('href: "/settings"');
    expect(rail).toContain('href: "/support"');
  });

  it("removes permanent provider tools from the account rail", () => {
    expect(rail).not.toContain('data-testid="provider-secondary-tools"');
    expect(rail).not.toContain('href="/provider"');
    expect(rail).not.toContain('href="/provider/studio"');
    expect(rail).not.toContain('href="/provider/payments"');
    expect(rail).toContain('supabase.auth.signOut({ scope: "local" })');
  });

  it("does not touch delete-account or Stripe/payment implementation", () => {
    expect(rail).not.toContain("/api/account/delete");
    expect(rail).not.toContain("stripe");
    expect(rail).not.toContain("Stripe");
  });
});
