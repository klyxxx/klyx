import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function accountMenuMode(source: string) {
  const start = source.indexOf('if (mode === "account-menu")');
  const end = source.indexOf("\n  return (", start);

  if (start < 0 || end < 0) return "";
  return source.slice(start, end);
}

const layout = read("app/layout.tsx");
const shell = read("app/ui/AssistantShell.tsx");
const rail = read("app/ui/MissionRail.tsx");
const accountSwitcher = read("app/components/AccountSwitcher.tsx");
const accountMenu = accountMenuMode(accountSwitcher);

describe("KLYX assistant-first shell and mission rail", () => {
  it("mounts AssistantShell globally instead of the SaaS sidebar", () => {
    expect(layout).toContain('import AssistantShell from "@/app/ui/AssistantShell";');
    expect(layout).toContain("<AssistantShell />");
    expect(layout).not.toContain("<AppSidebar />");
  });

  it("keeps Founder/Admin isolated while public provider routes use the assistant shell", () => {
    for (const route of [
      '"/founder"',
      '"/admin"',
      '"/recommendations"',
    ]) {
      expect(shell).toContain(route);
    }

    expect(shell).not.toContain('  "/providers",');
    expect(shell).toContain("return <AppSidebar />;");
    expect(shell).toContain("<MissionRail");
  });

  it("uses the conversational role homes for both account types", () => {
    expect(shell).toContain("getKlyxAccountHome(accountType)");
    expect(rail).toContain('data-testid="new-mission-action"');
    expect(rail).toContain('newMission: "Nouvelle mission"');
  });

  it("keeps the collapsible desktop rail but makes history opt-in and compact", () => {
    expect(rail).toContain('data-testid={mobile ? "mobile-mission-rail" : "desktop-mission-rail"}');
    expect(rail).toContain('compact ? "w-[76px]" : "w-[256px]"');
    expect(rail).toContain('history: "Historique"');
    expect(rail).toContain('data-testid="mission-history"');
    expect(rail).toContain("const [historyOpen, setHistoryOpen] = useState(false)");
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

  it("keeps provider tools secondary while delegating account actions to the canonical menu", () => {
    expect(shell).not.toContain('href="/messages"');
    expect(shell).not.toContain('href="/bookings"');
    expect(shell).not.toContain('href="/provider/jobs"');
    expect(shell).not.toContain('href="/profile"');

    expect(rail).not.toContain('href="/messages"');
    expect(rail).toContain("<AccountSwitcher");
    expect(rail).toContain('mode="account-menu"');
    expect(rail).toContain('data-testid="provider-secondary-tools"');
    expect(rail).toContain('href="/provider"');
    expect(rail).toContain('href="/provider/studio"');
    expect(rail).toContain('href="/provider/payments"');

    expect(accountMenu).toContain('data-testid="account-entry"');
    expect(accountMenu).toContain('role="menuitemradio"');
    expect(accountMenu).toContain('href="/profile"');
    expect(accountMenu).toContain('href="/settings"');
    expect(accountMenu).toContain('href="/support"');
    expect(accountMenu).not.toContain('href="/accounts"');
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
