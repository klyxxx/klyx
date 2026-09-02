import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX provider Missions destination UX contract", () => {
  it("keeps business reads and offer writes while progressively revealing the offer form", () => {
    const source = read("app/provider/jobs/page.tsx");

    expect(source).toContain("KLYX_PROVIDER_JOBS_DESTINATION_2026_09_01");
    expect(source).toContain('fetch("/api/provider/jobs"');
    expect(source).toContain('"/api/market/requests/" + request.id + "/offers"');
    expect(source).toContain("const [openOfferId, setOpenOfferId] = useState<string | null>(null)");
    expect(source).toContain("aria-expanded={offerOpen}");
    expect(source).toContain("{offerOpen && (");
    expect(source).toContain("/provider/assistant?prompt=");
    expect(source).toContain("automaticExecutionAllowed");
  });

  it("unifies opportunities and confirmed work behind one stable next-action lifecycle", () => {
    const source = read("app/provider/jobs/page.tsx");
    const confirmed = read("app/provider/jobs/ProviderConfirmedMissionsSection.tsx");
    const copy = read("lib/klyx-provider-missions-i18n.ts");

    expect(source).toContain("KLYX_PROVIDER_MISSIONS_LIFECYCLE_2026_09_02");
    expect(source).toContain('fetch("/api/bookings/overview"');
    expect(source).toContain("ProviderConfirmedMissionsSection");
    expect(source).toContain("providerMissionPriority");
    expect(source).toContain("const actionMission =");
    expect(source).toContain("const priorityMission =");
    expect(source).toContain("useCallback<Translator>");
    expect(source).toContain("}, [t]);");
    expect(source).not.toContain("const t: Translator = (key)");

    expect(confirmed).toContain("actionRequired");
    expect(confirmed).toContain("history");
    expect(confirmed).toContain("/bookings/");
    expect(copy).toContain('"lifecycleNote"');
    expect(copy).toContain('"missionUpcoming"');
  });

  it("uses the calm destination language without legacy or multicolor status accents", () => {
    const source = read("app/provider/jobs/page.tsx");

    expect(source).toContain('className="klyx-page"');
    expect(source).toContain("klyx-eyebrow");
    expect(source).toContain("klyx-button");
    expect(source).not.toContain("violet-");
    expect(source).not.toContain("indigo-");
    expect(source).not.toContain("bg-gradient");
    expect(source).not.toContain("shadow-");
    expect(source).not.toContain("ring-");
    expect(source).not.toContain("amber-");
    expect(source).not.toContain("emerald-");
    expect(source).not.toContain("red-");
    expect(source).not.toContain("rose-");
  });
});
