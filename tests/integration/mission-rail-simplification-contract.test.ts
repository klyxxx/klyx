import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const rail = read("app/ui/MissionRail.tsx");
const accountMenu = read("app/components/AccountSwitcher.tsx");

describe("KLYX MissionRail compact ChatGPT-style contract", () => {
  it("keeps one account entry and delegates account actions to the canonical switcher", () => {
    expect(rail.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(rail).toContain('mode="account-menu"');
    expect(rail).toContain("compact={compact}");
    expect(rail).not.toContain('data-testid="account-entry"');

    expect(accountMenu).toContain('data-testid="account-entry"');
    expect(accountMenu).toContain('data-testid="account-menu-panel"');
    expect(accountMenu).toContain('role="menuitemradio"');

    for (const href of ["/profile", "/settings", "/support"]) {
      expect(accountMenu).toContain(`href="${href}"`);
    }

    for (const href of ["/provider", "/provider/studio", "/provider/payments"]) {
      expect(rail).toContain(`href="${href}"`);
    }

    expect(rail).not.toContain("password");
    expect(rail).not.toContain("Password");
    expect(accountMenu).not.toMatch(/password/i);
  });

  it("keeps every mission source and all mission metadata intact", () => {
    expect(rail).toContain('fetch("/api/bookings/overview"');
    expect(rail).toContain('fetch("/api/bookings/activity-hidden"');
    expect(rail).toContain('fetch("/api/bookings/split-missions"');
    expect(rail).toContain('fetch("/api/provider/jobs"');
    expect(rail).toContain("mission.statusLabel.trim()");
    expect(rail).toContain("dateTimeLabel(locale, mission.dateFrom)");
    expect(rail).toContain("missionRoleLabel(locale, mission.role)");
    expect(rail).toContain("sameFingerprint");
    expect(rail).toContain("nameDistinguishes");
    expect(rail).toContain('join(" · ")');
    expect(rail).not.toContain("slice(0, 5)");
  });

  it("shows only a discreet pinned mission until the user opens detailed history", () => {
    expect(rail).toContain("const [historyOpen, setHistoryOpen] = useState(false)");
    expect(rail).toContain('data-testid="mission-history"');
    expect(rail).toContain('data-testid="mission-history-entry"');
    expect(rail).toContain('data-testid="mission-history-detail"');
    expect(rail).toContain('history: "Historique"');
    expect(rail).toContain("return actionRequired ? [actionRequired] : []");
    expect(rail).toContain("pinnedMissions.map((mission) => missionRow(mission, pinnedMissions))");
    expect(rail).toContain("historySection(copy.current, copy.emptyCurrent, currentMissions)");
    expect(rail).toContain("historySection(copy.recent, copy.emptyRecent, recentMissions)");
  });

  it("uses compact icon/line affordances instead of permanent mission cards", () => {
    expect(rail).toContain("inline-grid h-10 w-10 place-items-center rounded-full");
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
