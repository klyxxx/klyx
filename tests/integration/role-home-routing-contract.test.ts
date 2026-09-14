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

describe("KLYX canonical assistant home routing", () => {
  it("maps every legacy account type to the same assistant home", () => {
    expect(accountHome).toContain('client: "/assistant"');
    expect(accountHome).toContain('provider: "/assistant"');
    expect(accountHome).toContain('return "/assistant" as const;');
    expect(accountHome).not.toContain('"/provider/assistant"');
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

  it("lets login use the compatibility route without rendering a role dashboard", () => {
    const redirects = login.match(/router\.replace\("\/dashboard"\)/g) ?? [];
    expect(redirects.length).toBeGreaterThanOrEqual(2);
    expect(dashboard).not.toContain("<main");
    expect(accountHome).not.toContain('provider: "/provider/assistant"');
  });

  it("does not duplicate the account switcher inside profile content", () => {
    expect(profileLayout).not.toContain("AccountSwitcher");
    expect(profileLayout).not.toContain("getActiveProfile");
  });

  it("returns from Profil to the single KLYX assistant home", () => {
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

  it("keeps the assistant as the primary navigation destination", () => {
    expect(sidebar).toContain('title: "KLYX"');
    expect(sidebar).toContain('href: "/assistant"');
    expect(sidebar).not.toContain('href: "/provider/assistant"');
  });
});
