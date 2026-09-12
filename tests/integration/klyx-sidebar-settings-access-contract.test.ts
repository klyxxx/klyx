import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX frozen sidebar and settings access contract", () => {
  const sidebar = read("app/ui/AppSidebar.tsx");
  const rail = read("app/ui/MissionRail.tsx");
  const account = read("app/components/AccountSwitcher.tsx");
  const profile = read("app/profile/page.tsx");
  const settings = read("app/settings/page.tsx");

  it("keeps service navigation while removing duplicated Profile/account controls", () => {
    for (const href of [
      "/assistant",
      "/bookings",
      "/messages",
      "/provider/jobs",
      "/provider/studio",
      "/provider/payments",
    ]) {
      expect(sidebar).toContain(`href: "${href}"`);
    }

    expect(sidebar).not.toContain('href: "/profile"');
    expect(sidebar.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(sidebar).not.toContain('href: "/settings"');
    expect(sidebar).not.toContain("LogOut");
  });

  it("exposes Profile and Settings through the single account menu", () => {
    expect(profile).not.toContain('href="/settings"');
    expect(profile).not.toContain('t("settings")');
    expect(rail.match(/<AccountSwitcher/g) ?? []).toHaveLength(1);
    expect(account).toContain('href="/profile"');
    expect(account).toContain('href="/settings"');
    expect(account).toContain('href="/support"');
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
