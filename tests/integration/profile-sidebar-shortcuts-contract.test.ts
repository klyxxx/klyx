import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const profilePage = read("app/profile/page.tsx");
const rail = read("app/ui/MissionRail.tsx");
const accountMenu = read("app/components/AccountSwitcher.tsx");

describe("KLYX profile shortcuts", () => {
  it("removes provider-management and settings cards from the profile page", () => {
    expect(profilePage).not.toContain('href="/provider"');
    expect(profilePage).not.toContain('href="/settings"');
    expect(profilePage).not.toContain("manageProviderProfile");
  });

  it("keeps settings once in the canonical account menu and one provider commercial-profile entry", () => {
    expect(rail).not.toContain('href="/settings"');
    expect(accountMenu.match(/href="\/settings"/g) ?? []).toHaveLength(1);
    expect(rail.match(/href="\/provider"/g) ?? []).toHaveLength(1);
    expect(rail).toContain('commercialProfile: "Fiche commerciale"');
    expect(rail).toContain("{copy.commercialProfile}");
  });

  it("does not duplicate the existing provider services and finances shortcuts", () => {
    expect(rail.match(/href="\/provider\/studio"/g) ?? []).toHaveLength(1);
    expect(rail.match(/href="\/provider\/payments"/g) ?? []).toHaveLength(1);
  });
});
