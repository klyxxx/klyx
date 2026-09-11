import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const rail = read("app/ui/MissionRail.tsx");
const shell = read("app/ui/AssistantShell.tsx");
const accountMenu = read("app/components/AccountSwitcher.tsx");

describe("KLYX MissionRail simplification contract", () => {
  it("keeps the rail mission-only and exposes one primary account entry from the shell", () => {
    expect(rail).not.toContain("<AccountSwitcher");
    expect(rail).not.toContain('data-testid="account-entry"');
    expect(rail).not.toContain('data-testid="account-profile-switcher"');
    expect(rail).not.toContain('href="/profile"');
    expect(rail).not.toContain('href="/settings"');
    expect(rail).not.toContain('href="/accounts"');

    expect(shell.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(shell).toContain('mode="account-menu"');
    expect(accountMenu).toContain('data-testid="account-entry"');
    expect(accountMenu).not.toContain("password");
    expect(accountMenu).not.toContain("Password");
  });

  it("keeps every mission source while making repeated rows distinguishable from real metadata", () => {
    expect(rail).toContain('fetch("/api/bookings/overview"');
    expect(rail).toContain('fetch("/api/bookings/split-missions"');
    expect(rail).toContain('fetch("/api/provider/jobs"');
    expect(rail).toContain("mission.statusLabel.trim()");
    expect(rail).toContain("dateTimeLabel(locale, mission.dateFrom)");
    expect(rail).toContain("missionRoleLabel(locale, mission.role)");
    expect(rail).toContain("sameFingerprint");
    expect(rail).toContain("nameDistinguishes");
    expect(rail).toContain('join(" · ")');
  });

  it("renders mission history as a compact ChatGPT-style list instead of repeated cards", () => {
    expect(rail).toContain('className="space-y-0.5"');
    expect(rail).toContain("rounded-lg px-2 py-1.5");
    expect(rail).toContain('text-[13px] font-medium leading-5');
    expect(rail).toContain('text-[11px] leading-5 text-muted-foreground');
    expect(rail).not.toContain("rounded-xl px-2.5 py-2.5");
  });

  it("uses neutral rail surfaces with KLYX blue only for selection and action", () => {
    expect(rail).toContain("#2563EB");
    expect(rail).not.toContain("violet-");
    expect(rail).not.toContain("indigo-");
    expect(rail).not.toContain("purple-");
  });
});
