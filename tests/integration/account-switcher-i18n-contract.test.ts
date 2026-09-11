import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX account switcher i18n contract", () => {
  it("uses locale-aware copy for both the legacy switcher and compact account menu", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain("useKlyxLocale");
    expect(switcher).toContain("translateKlyxAccountSwitcher");
    expect(switcher).toContain('aria-label={t("menuAria")}');
    expect(switcher).toContain('{t("menuTitle")}');
    expect(switcher).toContain('{t("manageProfiles")}');
    expect(switcher).toContain('aria-label={t("accountMenuAria")}');
    expect(switcher).toContain('{t("myProfile")}');
    expect(switcher).toContain('{t("settings")}');
    expect(switcher).toContain('{t("support")}');
    expect(switcher).toContain('{loggingOut ? t("loggingOut") : t("logout")}');
    expect(switcher).not.toContain('aria-label="Changer de profil KLYX"');
    expect(switcher).not.toContain(">Gérer les profils<");
    expect(switcher).not.toContain(">Profils KLYX<");
  });

  it("preserves canonical profile switching and legacy profile management without a password prompt", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain('mode?: "switcher" | "account-menu";');
    expect(switcher).toContain('data-testid="account-switcher"');
    expect(switcher).toContain('data-testid="account-entry"');
    expect(switcher).toContain("profiles.length > 1");
    expect(switcher).toContain('role="menuitemradio"');
    expect(switcher).toContain("await switchAccount(profileId);");
    expect(switcher).toContain("setActiveProfileId(profileId);");
    expect(switcher).toContain(
      "ActiveProfileSync owns the full-document role transition."
    );
    expect(switcher).toContain('href="/accounts"');
    expect(switcher).toContain('href="/profile"');
    expect(switcher).toContain('href="/settings"');
    expect(switcher).toContain('href="/support"');
    expect(switcher).not.toContain("window.location");
    expect(switcher).not.toMatch(/password/i);
  });

  it("keeps component-facing failures localized instead of exposing raw helper errors", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain(
      'setError(translateKlyxAccountSwitcher(locale, "loadError"));'
    );
    expect(switcher).toContain('setError(t("missingProfileError"));');
    expect(switcher).toContain('setError(t("switchError"));');
    expect(switcher).not.toContain("loadError.message");
    expect(switcher).not.toContain("switchError.message");
  });
});
