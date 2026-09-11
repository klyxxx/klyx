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

describe("KLYX compact account menu multi-profile contract", () => {
  it("keeps Mohamed/Youssouf-style profile switching on the canonical no-password path", () => {
    expect(menu).toContain("getProfiles");
    expect(menu).toContain("profiles.length > 1");
    expect(menu).toContain("await switchAccount(profileId);");
    expect(menu).toContain('role="menuitemradio"');
    expect(menu).not.toMatch(/password/i);

    expect(accountSwitcher).toContain('fetch("/api/profiles/active", {');
    expect(accountSwitcher).toContain('method: "POST"');
    expect(accountSwitcher).toContain("body: JSON.stringify({ profileId })");
    expect(accountSwitcher).toContain(
      "emitActiveProfileChanged(profileId, result.accountType);"
    );
    expect(accountSwitcher).toContain("KLYX_ACTIVE_PROFILE_CHANGED");
    expect(accountSwitcher).not.toMatch(/password/i);
  });

  it("renders exactly one primary account entry and none in the mission rail", () => {
    expect(shell.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(shell).toContain('mode="account-menu"');
    expect(shell).toContain('data-testid="assistant-shell-account-slot"');
    expect(menu.match(/data-testid="account-entry"/g) ?? []).toHaveLength(1);
    expect(rail).not.toContain('data-testid="account-entry"');
    expect(rail).not.toContain("<AccountSwitcher");
  });

  it("keeps the compact account actions focused on profile, settings, support and logout", () => {
    expect(menu.match(/href="\/profile"/g) ?? []).toHaveLength(1);
    expect(menu.match(/href="\/settings"/g) ?? []).toHaveLength(1);
    expect(menu.match(/href="\/support"/g) ?? []).toHaveLength(1);
    expect(menu).toContain('supabase.auth.signOut({ scope: "local" })');
    expect(menu).not.toContain("/api/account/delete");
    expect(menu).not.toContain("stripe");
    expect(menu).not.toContain("Stripe");
  });
});
