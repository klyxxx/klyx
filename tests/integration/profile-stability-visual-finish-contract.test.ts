import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const layout = read("app/profile/layout.tsx");
const layoutStyles = read("app/profile/profile-layout.module.css");
const profile = read("app/profile/page.tsx");

describe("KLYX profile stability and visual finish", () => {
  it("owns scrolling inside the profile content viewport without horizontal overflow", () => {
    expect(layout).toContain('data-testid="profile-scroll-region"');
    expect(layout).toContain('import styles from "./profile-layout.module.css"');
    expect(layout).toContain("styles.scrollRegion");
    expect(layout).toContain("min-h-0");
    expect(layout).toContain("overflow-x-hidden");
    expect(layout).toContain("overflow-y-auto");

    expect(layoutStyles).toContain("height: calc(100dvh - 3.5rem)");
    expect(layoutStyles).toContain("@media (max-width: 63.999rem)");
    expect(layoutStyles).toContain(
      ":global(.klyx-app-content):has(.scrollRegion)"
    );
    expect(layoutStyles).toContain("min-height: calc(100dvh - 3.5rem)");
    expect(layoutStyles).toContain("@media (min-width: 64rem)");
    expect(layoutStyles).toContain("height: 100dvh");
    expect(layoutStyles).toContain("scrollbar-gutter: stable");

    expect(profile).toContain("KLYX_PROFILE_STABLE_SCROLL_2026_09_10");
    expect(profile).not.toContain("min-h-screen");
    expect(profile).toContain(
      "min-h-full w-full max-w-full overflow-x-hidden"
    );
    expect(profile).not.toContain("MissionRail");
  });

  it("keeps the profile summary compact and based only on persisted profile fields", () => {
    expect(profile).toContain("KLYX_PROFILE_COMPACT_CARD_2026_09_10");
    expect(profile).toContain('data-testid="profile-summary-card"');
    expect(profile).toContain('data-testid="profile-persisted-facts"');
    expect(profile).toContain("h-16 w-16");
    expect(profile).toContain('<ProfileFact label={t("firstName")} value={firstName} />');
    expect(profile).toContain('<ProfileFact label={t("lastName")} value={lastName} />');
    expect(profile).toContain('<ProfileFact label={t("city")} value={city} />');
    expect(profile).toContain('{age && <ProfileFact label={t("age")} value={age} />}');
    expect(profile).toContain("if (!value.trim()) return null");

    expect(profile).not.toContain("emailAddress");
    expect(profile).not.toContain("phoneNumber");
    expect(profile).not.toContain("companyName");
  });

  it("preserves progressive disclosure and the existing profile write boundaries", () => {
    expect(profile).toContain("aria-expanded={editingProfile}");
    expect(profile).toContain("{editingProfile && (");
    expect(profile).toContain('fetch("/api/profile/me"');
    expect(profile).toContain('fetch("/api/profile/avatar"');
    expect(profile).toContain('method: "PATCH"');
    expect(profile).toContain('method: "POST"');
  });
});
