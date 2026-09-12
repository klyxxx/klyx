import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const profilePage = read("app/profile/page.tsx");
const rail = read("app/ui/MissionRail.tsx");
const account = read("app/components/AccountSwitcher.tsx");
const sidebar = read("app/ui/AppSidebar.tsx");

describe("KLYX profile shortcuts", () => {
  it("removes provider-management and settings cards from the profile page", () => {
    expect(profilePage).not.toContain('href="/provider"');
    expect(profilePage).not.toContain('href="/settings"');
    expect(profilePage).not.toContain("manageProviderProfile");
  });

  it("keeps Profile and Settings only in the single account menu", () => {
    expect(rail.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(account.match(/href="\/profile"/g) ?? []).toHaveLength(1);
    expect(account.match(/href="\/settings"/g) ?? []).toHaveLength(1);
    expect(account).toContain('href="/support"');
    expect(account).not.toContain('href="/provider"');
    expect(account).not.toContain('href="/accounts"');
  });

  it("keeps provider service and finance destinations outside the Account menu", () => {
    expect(account).not.toContain('href="/provider/studio"');
    expect(account).not.toContain('href="/provider/payments"');
    expect(sidebar.match(/href: "\/provider\/studio"/g) ?? []).toHaveLength(1);
    expect(sidebar.match(/href: "\/provider\/payments"/g) ?? []).toHaveLength(1);
  });
});
