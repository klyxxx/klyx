import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

const accountHome = read("lib/account-home.ts");
const dashboard = read("app/dashboard/page.tsx");
const login = read("app/login/page.tsx");
const profileLayout = read("app/profile/layout.tsx");
const profilePage = read("app/profile/page.tsx");
const profileI18n = read("lib/klyx-profile-page-i18n.ts");
const sidebar = read("app/ui/AppSidebar.tsx");

describe("KLYX canonical role home routing", () => {
  it("keeps one shared client/provider conversational home mapping", () => {
    expect(accountHome).toContain('client: "/assistant"');
    expect(accountHome).toContain('provider: "/provider/assistant"');
    expect(accountHome).toContain("return KLYX_ACCOUNT_HOME[accountType];");
  });

  it("keeps /dashboard only as an authenticated compatibility router", () => {
    const source = compact(dashboard);

    expect(source).toContain('redirect("/login");');
    expect(source).toContain('redirect("/accounts");');
    expect(source).toContain("redirect(getKlyxAccountHome(profile.accountType));");

    for (const legacyImport of [
      "ClientDashboard",
      "ProviderDashboard",
      "DashboardResumeCenter",
      "Header",
      "AccountSwitcher",
      "isKlyxFounder",
    ]) {
      expect(dashboard).not.toContain(legacyImport);
    }
  });

  it("lets login use the compatibility route without rendering the legacy dashboard", () => {
    const redirects = login.match(/router\.replace\("\/dashboard"\)/g) ?? [];
    expect(redirects.length).toBeGreaterThanOrEqual(2);
    expect(dashboard).not.toContain("<main");
  });

  it("exposes profile switching from Profil without adding a client primary navigation item", () => {
    expect(profileLayout).toContain(
      'import AccountSwitcher from "@/app/components/AccountSwitcher";'
    );
    expect(profileLayout).toContain("const profile = await getActiveProfile();");
    expect(profileLayout).toContain(
      "<AccountSwitcher currentProfileId={profile.id} />"
    );
  });

  it("returns from Profil directly to the active role home", () => {
    expect(profilePage).toContain(
      'import { getKlyxAccountHome } from "@/lib/account-home";'
    );
    expect(profilePage).toContain(
      "const homeHref = getKlyxAccountHome(accountType);"
    );
    expect(profilePage).toContain("href={homeHref}");
    expect(profilePage).toContain('t("home")');
    expect(profilePage).not.toContain('href="/dashboard"');

    expect(profileI18n).toContain('home: "Accueil"');
    expect(profileI18n).toContain('home: "Home"');
    expect(profileI18n).toContain('home: "Start"');
    expect(profileI18n).not.toContain('"dashboard",');
  });

  it("keeps the definitive four-item role navigation", () => {
    expect(sidebar).toContain('title: "KLYX"');
    expect(sidebar).toContain('title: "Activité"');
    expect(sidebar).toContain('title: "Messages"');
    expect(sidebar).toContain('title: "Profil"');
    expect(sidebar).toContain('href: "/assistant"');
    expect(sidebar).toContain('href: "/bookings"');
    expect(sidebar).toContain('href: "/messages"');
    expect(sidebar).toContain('href: "/profile"');

    expect(sidebar).toContain('title: "Missions"');
    expect(sidebar).toContain('title: "Services"');
    expect(sidebar).toContain('title: "Finances"');
    expect(sidebar).toContain('href: "/provider/jobs"');
    expect(sidebar).toContain('href: "/provider/services"');
    expect(sidebar).toContain('href: "/provider/payments"');

    expect(sidebar).not.toContain('title: "Gestion"');
    expect(sidebar).not.toContain('href: "/provider/assistant"');
    expect(sidebar).not.toContain('href: "/provider/studio"');
  });
});
