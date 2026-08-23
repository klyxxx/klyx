import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX full public homepage i18n contract", () => {
  it("keeps app/page.tsx as a server boundary and delegates locale-aware presentation", () => {
    const page = read("app/page.tsx");
    const content = read("app/components/PublicHomeContent.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain(
      'import PublicHomeContent from "@/app/components/PublicHomeContent"'
    );
    expect(page).toContain("<PublicHomeContent />");
    expect(page).toContain("KLYX_PUBLIC_HOME_SERVER_BOUNDARY_16_10");

    expect(content).toContain('"use client"');
    expect(content).toContain("KLYX_PUBLIC_HOME_I18N_16_10");
    expect(content).toContain("useKlyxLocale()");
    expect(content).toContain("translateKlyxPublicHome(locale, key)");
  });

  it("preserves product journey, dual-entry markers and explicit signup destinations", () => {
    const page = read("app/page.tsx");
    const content = read("app/components/PublicHomeContent.tsx");

    expect(page).toContain("KLYX_PUBLIC_PRODUCT_JOURNEY_13_84");
    expect(page).toContain("KLYX_PUBLIC_DUAL_ENTRY_13_85");
    expect(content).toContain("KLYX_PUBLIC_PRODUCT_JOURNEY_13_84");
    expect(content).toContain("KLYX_PUBLIC_DUAL_ENTRY_13_85");
    expect(content).toContain('href="/signup?type=client"');
    expect(content).toContain('href="/signup?type=provider"');
    expect(content).toContain('href="/login"');
    expect(content).toContain('href="/signup"');
  });

  it("keeps session actions and install navigation without introducing transaction mutations", () => {
    const content = read("app/components/PublicHomeContent.tsx");

    expect(content).toContain("<PublicSessionActions compact />");
    expect(content).toContain("<PublicSessionActions />");
    expect(content.match(/href="\/install"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(content).toContain("<InstallKlyxButton />");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("renders safety and role copy through certified homepage dictionary keys", () => {
    const content = read("app/components/PublicHomeContent.tsx");
    const helper = read("lib/klyx-page-i18n.ts");

    for (const key of [
      "journeyConfirmText",
      "safetyTitle",
      "safetyDescription",
      "clientDescription",
      "providerDescription",
      "roleNote",
    ]) {
      expect(content).toContain(`t("${key}")`);
    }

    expect(content).not.toContain(
      "Publication de demande, réservation, paiement, annulation et remboursement"
    );
    expect(helper).toContain(
      "Publication de demande, réservation, paiement, annulation et remboursement restent soumis à une action explicite de ta part."
    );
    expect(helper).toContain(
      "Publishing a request, booking, payment, cancellation and refund remain subject to an explicit action from you."
    );
  });

  it("localizes PWA button states without changing installation mechanics", () => {
    const install = read("app/components/InstallKlyxButton.tsx");

    expect(install).toContain("useKlyxLocale()");
    expect(install).toContain("translateKlyxPublicHome(locale, key)");
    expect(install).toContain('window.addEventListener("beforeinstallprompt"');
    expect(install).toContain('window.addEventListener("appinstalled"');
    expect(install).toContain("await promptEvent.prompt()");
    expect(install).toContain("await promptEvent.userChoice");
    expect(install).toContain('choice.outcome === "accepted"');
    expect(install).toContain("isStandalone()");
    expect(install).toContain("isIos()");
    expect(install).toContain('t("installInstalled")');
    expect(install).toContain('t("installIosInstructions")');
    expect(install).toContain('t("installAutomatic")');
  });
});
