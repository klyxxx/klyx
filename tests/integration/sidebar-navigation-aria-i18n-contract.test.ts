import fs from "node:fs";
import path from "node:path";

import deCatalog from "@/messages/tolgee/de.json";
import enCatalog from "@/messages/tolgee/en.json";
import frCatalog from "@/messages/tolgee/fr.json";
import nlCatalog from "@/messages/tolgee/nl.json";
import { describe, expect, it } from "vitest";

const CATALOGS = {
  fr: frCatalog,
  en: enCatalog,
  nl: nlCatalog,
  de: deCatalog,
} as const;

const EXPECTED_NAVIGATION_LABELS = {
  fr: {
    desktopNavigation: "Navigation principale KLYX",
    mobileNavigation: "Navigation mobile KLYX",
  },
  en: {
    desktopNavigation: "Main KLYX navigation",
    mobileNavigation: "Mobile KLYX navigation",
  },
  nl: {
    desktopNavigation: "Hoofdnavigatie van KLYX",
    mobileNavigation: "Mobiele KLYX-navigatie",
  },
  de: {
    desktopNavigation: "KLYX-Hauptnavigation",
    mobileNavigation: "Mobile KLYX-Navigation",
  },
} as const;

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("sidebar navigation accessibility i18n contract", () => {
  it("uses Tolgee-backed aria labels with the three-item work navigation", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain(
      'const desktopNavigationLabel = t("sidebar.desktopNavigation");'
    );
    expect(sidebar).toContain(
      'const mobileNavigationLabel = t("sidebar.mobileNavigation");'
    );
    expect(sidebar).toContain("aria-label={desktopNavigationLabel}");
    expect(sidebar).toContain("aria-label={mobileNavigationLabel}");
    expect(sidebar).not.toContain("translateKlyxSidebarNavigation");
    expect(sidebar).not.toContain("klyx-sidebar-navigation-i18n");
    expect(sidebar).not.toContain('aria-label="Navigation principale KLYX"');
    expect(sidebar).not.toContain('aria-label="Navigation mobile KLYX"');

    expect(sidebar).toContain('data-testid="desktop-navigation"');
    expect(sidebar).toContain('data-testid="mobile-navigation"');
    expect(sidebar).toContain("grid-cols-3");
  });

  it("preserves the certified labels exactly in every published Tolgee catalog", () => {
    for (const [locale, expected] of Object.entries(EXPECTED_NAVIGATION_LABELS)) {
      const catalog = CATALOGS[locale as keyof typeof CATALOGS];

      expect(catalog["ui.sidebar.desktopNavigation"]).toBe(
        expected.desktopNavigation
      );
      expect(catalog["ui.sidebar.mobileNavigation"]).toBe(
        expected.mobileNavigation
      );
    }
  });

  it("removes the legacy sidebar navigation dictionary", () => {
    expect(
      fs.existsSync(
        path.join(process.cwd(), "lib/klyx-sidebar-navigation-i18n.ts")
      )
    ).toBe(false);
  });

  it("preserves the separately localized provider assistant launcher", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain(
      'translateKlyxProviderAssistant(locale, "badge")'
    );
    expect(sidebar).toContain('data-testid="provider-assistant-launcher-desktop"');
    expect(sidebar).toContain('data-testid="provider-assistant-launcher-mobile"');
    expect(sidebar).toContain("aria-label={providerAssistantLabel}");
  });
});
