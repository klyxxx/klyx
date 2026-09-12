import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX account switcher i18n contract", () => {
  it("uses locale-aware account copy for the bottom account menu", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain("useKlyxLocale");
    expect(switcher).toContain("translateKlyxAccountSwitcher");
    expect(switcher).toContain('aria-label={t("menuAria")}');
    expect(switcher).toContain('profile: "Profil"');
    expect(switcher).toContain('settings: "Paramètres"');
    expect(switcher).toContain('help: "Aide"');
    expect(switcher).toContain('logout: "Déconnexion"');
    expect(switcher).not.toContain('aria-label="Changer de profil KLYX"');
  });

  it("preserves one-click profile switching without exposing profile management as a second entry", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain('data-testid="account-switcher"');
    expect(switcher).toContain('data-testid="account-entry"');
    expect(switcher).toContain('await switchAccount(profileId);');
    expect(switcher).toContain('setActiveProfileId(profileId);');
    expect(switcher).toContain(
      'ActiveProfileSync owns the full-document role transition.'
    );
    expect(switcher).not.toContain('href="/accounts"');
    expect(switcher).not.toContain("window.location");
  });

  it("keeps component-facing failures localized instead of exposing raw helper errors", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain(
      'setError(translateKlyxAccountSwitcher(locale, "loadError"));'
    );
    expect(switcher).toContain('setError(t("missingProfileError"));');
    expect(switcher).toContain('setError(t("switchError"));');
    expect(switcher).not.toContain('loadError.message');
    expect(switcher).not.toContain('switchError.message');
  });
});
