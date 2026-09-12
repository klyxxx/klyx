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

describe("KLYX compact rail account menu contract", () => {
  it("keeps profile switching on the canonical no-password path", () => {
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

  it("keeps the primary account entry inside the MissionRail and opens its panel upward", () => {
    expect(shell).not.toContain('data-testid="assistant-shell-account-slot"');
    expect(shell).not.toContain("<AccountSwitcher");

    expect(rail.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(rail).toContain('mode="account-menu"');
    expect(rail).toContain("compact={compact}");
    expect(menu).toContain('data-testid="account-entry"');
    expect(menu).toContain('data-testid="account-menu-panel"');
    expect(menu).toContain("bottom-full left-0");
  });

  it("keeps account actions concise while preserving provider tools outside the menu", () => {
    expect(menu.match(/href="\/profile"/g) ?? []).toHaveLength(1);
    expect(menu.match(/href="\/settings"/g) ?? []).toHaveLength(1);
    expect(menu.match(/href="\/support"/g) ?? []).toHaveLength(1);
    expect(menu).toContain('supabase.auth.signOut({ scope: "local" })');

    expect(rail).toContain('data-testid="provider-secondary-tools"');
    expect(rail).toContain('href="/provider"');
    expect(rail).toContain('href="/provider/studio"');
    expect(rail).toContain('href="/provider/payments"');
  });

  it("does not touch delete-account or Stripe/payment implementation", () => {
    expect(menu).not.toContain("/api/account/delete");
    expect(menu).not.toContain("stripe");
    expect(menu).not.toContain("Stripe");
    expect(rail).not.toContain("/api/account/delete");
    expect(rail).not.toContain("stripe");
    expect(rail).not.toContain("Stripe");
  });
});
