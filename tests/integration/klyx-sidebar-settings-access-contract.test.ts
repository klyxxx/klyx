import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX unified shell and settings access contract", () => {
  const sidebar = read("app/ui/AppSidebar.tsx");
  const rail = read("app/ui/MissionRail.tsx");
  const profile = read("app/profile/page.tsx");
  const settings = read("app/settings/page.tsx");

  it("keeps one roleless shell destination set", () => {
    for (const href of ["/assistant", "/bookings", "/messages", "/profile"]) {
      expect(sidebar).toContain(`href: "${href}"`);
    }

    expect(sidebar).not.toContain("AccountSwitcher");
    expect(sidebar).not.toContain('href: "/provider/jobs"');
    expect(sidebar).not.toContain('href: "/provider/studio"');
    expect(sidebar).not.toContain('href: "/provider/payments"');
    expect(sidebar).not.toContain('href: "/settings"');
  });

  it("exposes Settings through the roleless mission-rail account area", () => {
    expect(profile).not.toContain('href="/settings"');
    expect(profile).not.toContain('t("settings")');
    expect(rail).not.toContain("AccountSwitcher");
    expect(rail).toContain('data-testid="account-entry"');
    expect(rail).toContain('href: "/profile"');
    expect(rail).toContain('href: "/settings"');
    expect(rail).toContain('href: "/support"');
    expect(settings).toContain('href="/profile"');
  });

  it("removes duplicated profile management from Settings", () => {
    expect(settings).toContain("KLYX_SETTINGS_PROFILE_DEDUPLICATED");
    expect(settings).not.toContain("switchAccount");
    expect(settings).not.toContain("savingProfile");
    expect(settings).not.toContain('fetch("/api/profile/me"');
  });

  it("keeps phone privacy history visible and removes legacy violet from Settings surfaces", () => {
    expect(settings).toContain("<PhoneAccessHistory />");

    for (const file of [
      "app/settings/page.tsx",
      "app/settings/PhoneSettingsInline.tsx",
      "app/settings/PhonePrivacyControls.tsx",
      "app/settings/PhoneAccessHistory.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toContain("violet-");
      expect(source).not.toContain("indigo-");
    }
  });
});
