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
    expect(rail).toContain("setCollapsed((value) => !value)");
    expect(rail).toContain('fetch("/api/bookings/overview"');
    expect(rail).toContain('fetch("/api/bookings/split-missions"');
    expect(rail).toContain('fetch("/api/provider/jobs"');
  });

  it("removes permanent SaaS destinations while keeping provider tools secondary", () => {
    expect(shell).not.toContain('href="/messages"');
    expect(shell).not.toContain('href="/bookings"');
    expect(shell).not.toContain('href="/provider/jobs"');
    expect(shell).not.toContain('href="/profile"');

    expect(rail).not.toContain('href="/messages"');
    expect(rail).toContain('href="/profile"');
    expect(rail).toContain('href="/provider/studio"');
    expect(rail).toContain('href="/provider/payments"');
    expect(rail).toContain('href="/settings"');
    expect(rail).toContain('href="/accounts"');
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
