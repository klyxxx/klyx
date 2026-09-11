import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const layout = read("app/layout.tsx");
const shell = read("app/ui/AssistantShell.tsx");
const rail = read("app/ui/MissionRail.tsx");
const accountMenu = read("app/components/AccountSwitcher.tsx");

describe("KLYX assistant-first shell and mission rail", () => {
  it("mounts AssistantShell globally instead of the SaaS sidebar", () => {
    expect(layout).toContain('import AssistantShell from "@/app/ui/AssistantShell";');
    expect(layout).toContain("<AssistantShell />");
    expect(layout).not.toContain("<AppSidebar />");
  });

  it("preserves explicitly out-of-scope surfaces on the legacy shell", () => {
    for (const route of [
      '"/founder"',
      '"/admin"',
      '"/recommendations"',
      '"/providers"',
    ]) {
      expect(shell).toContain(route);
    }

    expect(shell).toContain("return <AppSidebar />;");
  });

  it("uses the conversational role homes for both account types", () => {
    expect(shell).toContain("getKlyxAccountHome(accountType)");
    expect(rail).toContain('data-testid="new-mission-action"');
    expect(rail).toContain('newMission: "Nouvelle mission"');
  });

  it("renders a collapsible 256px desktop mission rail with current and recent missions", () => {
    expect(rail).toContain('data-testid={mobile ? "mobile-mission-rail" : "desktop-mission-rail"}');
    expect(rail).toContain('compact ? "w-[76px]" : "w-[256px]"');
    expect(rail).toContain('current: "En cours"');
    expect(rail).toContain('recent: "Récentes"');
    expect(rail).toContain("setCollapsedPreference(!collapsed)");
    expect(rail).toContain('fetch("/api/bookings/overview"');
    expect(rail).toContain('fetch("/api/bookings/split-missions"');
    expect(rail).toContain('fetch("/api/provider/jobs"');
  });

  it("persists only the desktop rail collapsed preference", () => {
    expect(rail).toContain('const RAIL_COLLAPSED_STORAGE_KEY = "klyx:mission-rail:collapsed";');
    expect(rail).toContain("window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY)");
    expect(rail).toContain("window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, String(next))");
    expect(rail).toContain('stored === "true" || stored === "false"');
  });

  it("marks the mission matching the current route accessibly and discreetly", () => {
    expect(rail).toContain("usePathname");
    expect(rail).toContain("normalizePath(mission.href) === currentPath");
    expect(rail).toContain('aria-current={active ? "page" : undefined}');
    expect(rail).toContain('bg-[#2563EB]');
    expect(rail).toContain('title={meta ? `${mission.title} — ${meta}` : mission.title}');
  });

  it("moves account navigation out of the rail into one primary top-right menu", () => {
    expect(shell).toContain('data-testid="assistant-shell-account-slot"');
    expect(shell).toContain('<AccountSwitcher');
    expect(shell).toContain('mode="account-menu"');

    expect(rail).not.toContain('data-testid="account-entry"');
    expect(rail).not.toContain('<AccountSwitcher');
    expect(rail).not.toContain('href="/profile"');
    expect(rail).not.toContain('href="/settings"');
    expect(rail).not.toContain('href="/accounts"');

    expect(accountMenu).toContain('data-testid="account-entry"');
    expect(accountMenu).toContain('href="/profile"');
    expect(accountMenu).toContain('href="/settings"');
    expect(accountMenu).toContain('href="/support"');
  });

  it("replaces the mobile four-tab bar with an accessible drawer", () => {
    expect(shell).toContain('data-testid="assistant-shell-mobile-header"');
    expect(shell).toContain('data-testid="assistant-shell-mobile-menu"');
    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain("trapDialogTabKey");
    expect(shell).toContain("mobileMenuTriggerRef");
    expect(shell).not.toContain('data-testid="mobile-navigation"');
    expect(shell).not.toContain("grid-cols-4");
  });
});
