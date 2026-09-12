import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const layout = read("app/layout.tsx");
const shell = read("app/ui/AssistantShell.tsx");
const rail = read("app/ui/MissionRail.tsx");
const account = read("app/components/AccountSwitcher.tsx");

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

  it("keeps one Account entry at rail bottom with only account actions in its upward menu", () => {
    expect(shell).not.toContain('href="/messages"');
    expect(shell).not.toContain('href="/bookings"');
    expect(shell).not.toContain('href="/provider/jobs"');
    expect(shell).not.toContain('href="/profile"');

    expect(rail).not.toContain('href="/messages"');
    expect(rail.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(rail).toContain("compact={compact}");

    expect(account).toContain('data-testid="account-entry"');
    expect(account).toContain('data-testid="account-menu"');
    expect(account).toContain("bottom-full");
    expect(account).toContain('href="/profile"');
    expect(account).toContain('href="/settings"');
    expect(account).toContain('href="/support"');
    expect(account).not.toContain('href="/accounts"');
    expect(account).not.toContain('href="/provider/studio"');
    expect(account).not.toContain('href="/provider/payments"');
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
