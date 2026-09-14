import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const layout = read("app/layout.tsx");
const shell = read("app/ui/AssistantShell.tsx");
const rail = read("app/ui/MissionRail.tsx");

describe("KLYX assistant-first shell and mission rail", () => {
  it("mounts AssistantShell globally instead of the SaaS sidebar", () => {
    expect(layout).toContain('import AssistantShell from "@/app/ui/AssistantShell";');
    expect(layout).toContain("<AssistantShell />");
    expect(layout).not.toContain("<AppSidebar />");
  });

  it("keeps Founder/Admin isolated while normal routes use one assistant shell", () => {
    for (const route of [
      '"/founder"',
      '"/admin"',
      '"/recommendations"',
    ]) {
      expect(shell).toContain(route);
    }

    expect(shell).toContain("return <AppSidebar />;");
    expect(shell).toContain("<MissionRail");
    expect(shell).not.toContain("accountType");
    expect(shell).not.toContain("activeProfileId");
    expect(shell).not.toContain("KLYX_ACTIVE_PROFILE_CHANGED");
    expect(shell).not.toContain("resolveAssistantShellProfileContext");
  });

  it("uses /assistant as the only conversational home", () => {
    expect(shell).toContain('<MissionRail homeHref="/assistant" locale={locale} />');
    expect(shell).toContain('<KlyxLogo href="/assistant" compact />');
    expect(rail).toContain('data-testid="new-mission-action"');
    expect(rail).toContain('newMission: "Nouvelle mission"');
  });

  it("keeps the collapsible mission history independent from permanent roles", () => {
    expect(rail).toContain('data-testid={mobile ? "mobile-mission-rail" : "desktop-mission-rail"}');
    expect(rail).toContain('compact ? "w-[76px]" : "w-[256px]"');
    expect(rail).toContain('history: "Historique"');
    expect(rail).toContain('data-testid="mission-history"');
    expect(rail).toContain("const [historyOpen, setHistoryOpen] = useState(false)");
    expect(rail).toContain("setCollapsedPreference(!collapsed)");
    expect(rail).toContain('fetch("/api/bookings/overview"');
    expect(rail).toContain('fetch("/api/bookings/split-missions"');
    expect(rail).not.toContain('fetch("/api/provider/jobs"');
    expect(rail).not.toContain('accountType === "provider"');
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

  it("replaces profile switching with one account menu", () => {
    expect(rail).not.toContain("AccountSwitcher");
    expect(rail).not.toContain("provider-secondary-tools");
    expect(rail).not.toContain('href="/provider"');
    expect(rail).not.toContain('href="/provider/studio"');
    expect(rail).not.toContain('href="/provider/payments"');
    expect(rail).toContain('href: "/profile"');
    expect(rail).toContain('href: "/settings"');
    expect(rail).toContain('href: "/support"');
    expect(rail).toContain('data-testid="account-entry"');
  });

  it("uses an accessible mobile drawer", () => {
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
