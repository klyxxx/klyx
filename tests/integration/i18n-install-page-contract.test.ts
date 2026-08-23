import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX install page i18n contract", () => {
  it("keeps the install route as a server boundary with locale-aware metadata", () => {
    const page = read("app/install/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_INSTALL_PAGE_SERVER_BOUNDARY_16_11");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain(
      'translateKlyxInstallPage(locale, "metadataTitle")'
    );
    expect(page).toContain(
      'translateKlyxInstallPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<InstallPageContent />");
  });

  it("delegates visible copy to the locale-aware client presentation", () => {
    const content = read("app/install/InstallPageContent.tsx");

    expect(content).toContain('"use client"');
    expect(content).toContain("KLYX_INSTALL_PAGE_I18N_16_11");
    expect(content).toContain("useKlyxLocale()");
    expect(content).toContain("translateKlyxInstallPage(locale, key)");
    expect(content).toContain("<InstallKlyxButton />");

    for (const key of [
      "heroTitle",
      "heroDescription",
      "androidDescription",
      "iosDescription",
      "desktopDescription",
      "benefitNoStore",
      "browserDescription",
      "currentVersionDescription",
    ]) {
      expect(content).toContain(`t("${key}")`);
    }
  });

  it("preserves install navigation without introducing product mutations", () => {
    const content = read("app/install/InstallPageContent.tsx");

    expect(content).toContain('href="/"');
    expect(content.match(/href="\/login"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(content).toContain('href="/signup"');
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("keeps the PWA versus store-app warning in the certified dictionary", () => {
    const content = read("app/install/InstallPageContent.tsx");
    const helper = read("lib/klyx-install-page-i18n.ts");

    expect(content).toContain('t("currentVersionDescription")');
    expect(content).not.toContain(
      "Ce n’est pas encore une application publiée sur l’App Store ou Google Play."
    );
    expect(helper).toContain(
      "Ce n’est pas encore une application publiée sur l’App Store ou Google Play."
    );
    expect(helper).toContain(
      "It is not yet an app published on the App Store or Google Play."
    );
    expect(helper).toContain(
      "Het is nog geen app die in de App Store of Google Play is gepubliceerd."
    );
    expect(helper).toContain(
      "Sie ist noch keine im App Store oder bei Google Play veröffentlichte App."
    );
  });

  it("leaves the already-certified PWA installation mechanics untouched", () => {
    const installButton = read("app/components/InstallKlyxButton.tsx");

    expect(installButton).toContain(
      'window.addEventListener("beforeinstallprompt"'
    );
    expect(installButton).toContain('window.addEventListener("appinstalled"');
    expect(installButton).toContain("await promptEvent.prompt()");
    expect(installButton).toContain("await promptEvent.userChoice");
    expect(installButton).toContain('choice.outcome === "accepted"');
    expect(installButton).toContain("isStandalone()");
    expect(installButton).toContain("isIos()");
  });
});
