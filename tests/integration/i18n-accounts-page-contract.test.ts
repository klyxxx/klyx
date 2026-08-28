import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX accounts page i18n contract", () => {
  it("keeps the multi-profile behavior intact while localizing the page", () => {
    const page = read("app/accounts/page.tsx");

    expect(page).toContain("KLYX_ACCOUNTS_PAGE_I18N_16_06");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxAccountsPage");
    expect(page).toContain("await switchAccount(profileId)");
    expect(page).toContain('router.push("/dashboard")');
    expect(page).toContain("createProfile({");
    expect(page).toContain("await deleteProfile(profile.id)");
    expect(page).toContain("const MAX_PROFILES = 5");
  });

  it("does not reflect raw account-switcher, storage or API errors", () => {
    const page = read("app/accounts/page.tsx");

    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("loadError instanceof Error");
    expect(page).not.toContain("submitError instanceof Error");
    expect(page).not.toContain("switchError instanceof Error");
    expect(page).not.toContain("deleteError instanceof Error");
    expect(page).not.toContain("uploadError.message");
    expect(page).not.toContain("submitError.message");
    expect(page).not.toContain("switchError.message");
    expect(page).not.toContain("deleteError.message");
  });

  it("moves representative French UI copy out of the page component", () => {
    const page = read("app/accounts/page.tsx");

    expect(page).not.toContain("Chargement des profils...");
    expect(page).not.toContain("Ajouter un profil client");
    expect(page).not.toContain("Ajouter un profil prestataire");
    expect(page).not.toContain("Retour au tableau de bord");
    expect(page).not.toContain("Supprimer le profil");
    expect(page).not.toContain("Choisir une photo");
    expect(page).not.toContain("Premier métier");
  });

  it("keeps city validation independent from translated labels", () => {
    const page = read("app/accounts/page.tsx");

    expect(page).toContain('autoComplete="address-level2"');
    expect(page).toContain("maxLength={100}");
    expect(page).not.toContain('maxLength={label === "Ville" ? 100 : 60}');
  });

  it("ships complete typed dictionaries for the initial launch locales", () => {
    const dictionary = read("lib/klyx-accounts-page-i18n.ts");

    expect(dictionary).toContain('"fr"');
    expect(dictionary).toContain('"en"');
    expect(dictionary).toContain('"nl"');
    expect(dictionary).toContain('"de"');
    expect(dictionary).toContain(
      "Record<KlyxAccountsPageLocale, Dictionary>"
    );
    expect(dictionary).toContain("replaceAll");
  });
});
