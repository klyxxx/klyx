import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX dashboard i18n and safe-error contract", () => {
  it("keeps /dashboard as a role-home compatibility route while preserving legacy i18n coverage", () => {
    const page = read("app/dashboard/page.tsx");
    const resume = read("app/dashboard/DashboardResumeCenter.tsx");

    expect(page).toContain(
      'import { getKlyxAccountHome } from "@/lib/account-home";'
    );
    expect(page).toContain("redirect(getKlyxAccountHome(profile.accountType));");
    expect(page).not.toContain("DashboardResumeCenter");
    expect(page).not.toContain("KLYX_AI_FIRST_DASHBOARD_15_02");
    expect(page).not.toContain("<main");

    expect(resume).toContain("KLYX_DASHBOARD_I18N_16_08");
    expect(resume).toContain('href="/provider/jobs"');
    expect(resume).toContain('href="/provider"');
    expect(resume).toContain('href="/assistant/market"');
    expect(resume).toContain('href="/search"');
    expect(resume).not.toContain("Reprendre mon parcours");
  });

  it("localizes the client and provider dashboard surfaces", () => {
    for (const file of [
      "app/dashboard/Header.tsx",
      "app/dashboard/ClientDashboard.tsx",
      "app/dashboard/ProviderDashboard.tsx",
      "app/components/DashboardActionCenter.tsx",
      "app/dashboard/ProviderActivitySnapshot.tsx",
      "app/dashboard/NotificationBell.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("useKlyxLocale");
      expect(source).toContain("translateKlyxDashboard");
    }

    expect(read("app/dashboard/ClientDashboard.tsx")).not.toContain(
      "L’essentiel, sans surcharge"
    );
    expect(read("app/dashboard/ProviderDashboard.tsx")).not.toContain(
      "Ton activité, classée par fonction"
    );
  });

  it("never reflects raw action-center, activity or Supabase notification errors", () => {
    const actions = read("app/components/DashboardActionCenter.tsx");
    const activity = read("app/dashboard/ProviderActivitySnapshot.tsx");
    const notifications = read("app/dashboard/NotificationBell.tsx");

    expect(actions).not.toContain("quotesBody.error");
    expect(actions).not.toContain("bookingsBody.error");
    expect(actions).not.toContain("error.message");
    expect(activity).not.toContain("body.error");
    expect(activity).not.toContain("error.message");
    expect(notifications).not.toContain("error.message");
    expect(notifications).toContain("notificationsLoadFailed");
  });

  it("preserves the dashboard data contracts and active routes", () => {
    const actions = read("app/components/DashboardActionCenter.tsx");
    const activity = read("app/dashboard/ProviderActivitySnapshot.tsx");
    const provider = read("app/dashboard/ProviderDashboard.tsx");

    expect(actions).toContain('fetch("/api/quotes"');
    expect(actions).toContain('fetch("/api/bookings/overview"');
    expect(actions).toContain('href: "/provider/quotes"');
    expect(actions).toContain('href: "/quotes"');
    expect(activity).toContain('fetch("/api/provider/activity-summary"');
    expect(provider).toContain('href: "/provider/payments"');
  });

  it("ships typed launch-locale dictionaries and locale-aware notification dates", () => {
    const dictionary = read("lib/klyx-dashboard-i18n.ts");
    const notifications = read("app/dashboard/NotificationBell.tsx");

    expect(dictionary).toContain('"fr"');
    expect(dictionary).toContain('"en"');
    expect(dictionary).toContain('"nl"');
    expect(dictionary).toContain('"de"');
    expect(dictionary).toContain("Record<KlyxDashboardLocale, Dictionary>");
    expect(dictionary).toContain("klyxDashboardDateLocale");
    expect(notifications).not.toContain('Intl.DateTimeFormat("fr-BE"');
    expect(notifications).toContain("klyxDashboardDateLocale(locale)");
  });
});
