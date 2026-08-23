import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission i18n contract", () => {
  it("localizes presentation without changing mission classification semantics", () => {
    const source = read("app/bookings/SplitMissionSection.tsx");

    expect(source).toContain("KLYX_SPLIT_MISSION_UI_13_21");
    expect(source).toContain("KLYX_SPLIT_MISSION_I18N_16_08");
    expect(source).toContain("function splitMissionNeedsAction(");
    expect(source).toContain("function splitMissionIsHistory(");
    expect(source).toContain("function splitMissionMatchesFilter(");
    expect(source).toContain('mission.status === "recovery_required"');
    expect(source).toContain('mission.status === "mixed_issue"');
    expect(source).toContain('mission.status === "completed"');
    expect(source).toContain('mission.status === "cancelled"');
  });

  it("keeps the surface read-only and preserves the split mission destination", () => {
    const source = read("app/bookings/SplitMissionSection.tsx");

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PUT"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
    expect(source).toContain('href={"/bookings/split/" + mission.batchId}');
  });

  it("uses locale-aware status, service and date presentation", () => {
    const source = read("app/bookings/SplitMissionSection.tsx");

    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("formatKlyxSplitMissionStatus(");
    expect(source).toContain("formatKlyxSplitMissionService(");
    expect(source).toContain("formatKlyxSplitMissionDate(");
    expect(source).toContain("formatKlyxSplitMissionSummary(");
    expect(source).not.toContain('new Intl.DateTimeFormat(\n    "fr-BE"');
  });

  it("keeps the no-extra-payment safety notice in the certified dictionaries", () => {
    const helper = read("lib/klyx-split-mission-i18n.ts");

    expect(helper).toContain(
      "Aucun paiement supplémentaire n’est déclenché ici."
    );
    expect(helper).toContain("No additional payment is triggered here.");
    expect(helper).toContain("Hier wordt geen extra betaling gestart.");
    expect(helper).toContain("Hier wird keine zusätzliche Zahlung ausgelöst.");
  });
});
