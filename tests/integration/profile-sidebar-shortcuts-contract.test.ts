import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const profilePage = read("app/profile/page.tsx");
const rail = read("app/ui/MissionRail.tsx");

describe("KLYX profile shortcuts", () => {
  it("removes provider-management and settings cards from the profile page", () => {
    expect(profilePage).not.toContain('href="/provider"');
    expect(profilePage).not.toContain('href="/settings"');
    expect(profilePage).not.toContain("manageProviderProfile");
  });

  it("keeps profile and settings in the single roleless account rail", () => {
    expect(rail).toContain('href: "/profile"');
    expect(rail).toContain('href: "/settings"');
    expect(rail).toContain('href: "/support"');
    expect(rail).not.toContain("AccountSwitcher");
  });

  it("does not expose permanent provider shortcuts in the shell", () => {
    expect(rail).not.toContain('href="/provider"');
    expect(rail).not.toContain('href="/provider/studio"');
    expect(rail).not.toContain('href="/provider/payments"');
    expect(rail).not.toContain("commercialProfile");
  });
});
