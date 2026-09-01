import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX frozen sidebar and settings access contract", () => {
  const sidebar = read("app/ui/AppSidebar.tsx");
  const profile = read("app/profile/page.tsx");
  const settings = read("app/settings/page.tsx");

  it("keeps the exact client and provider sidebar destinations", () => {
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

    expect(sidebar.match(/href: "\/profile"/g)?.length).toBe(2);
    expect(sidebar).toContain("<AccountSwitcher");
    expect(sidebar).not.toContain('href: "/settings"');
  });

  it("exposes Settings through Profile instead of adding sidebar navigation", () => {
    expect(profile).toContain("KLYX_PROFILE_SETTINGS_ENTRY");
    expect(profile).toContain('href="/settings"');
    expect(profile).toContain('t("settings")');
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
