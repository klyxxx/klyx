import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const rail = read("app/ui/MissionRail.tsx");

describe("KLYX MissionRail simplification contract", () => {
  it("keeps one account entry and nests profile switching with secondary account tools", () => {
    expect(rail.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(rail).toContain('data-testid="account-entry"');
    expect(rail).toContain('data-testid="account-profile-switcher"');

    const detailsIndex = rail.indexOf("<details");
    const switcherIndex = rail.indexOf("<AccountSwitcher");
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(detailsIndex);

    for (const href of [
      "/profile",
      "/provider",
      "/provider/studio",
      "/provider/payments",
      "/settings",
      "/accounts",
    ]) {
      expect(rail).toContain(`href="${href}"`);
    }

    expect(rail).not.toContain("password");
    expect(rail).not.toContain("Password");
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
