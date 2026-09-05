import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/components/AccountSwitcher.tsx"),
  "utf8"
);

describe("KLYX AccountSwitcher branding contract", () => {
  it("uses the exact KLYX blue for identity accents", () => {
    expect(source).toContain("bg-[#2563EB]/10");
    expect(source).toContain("text-[#2563EB]");

    expect(source).not.toMatch(/(?:bg|text|border|ring)-blue-/);
    expect(source).not.toMatch(/(?:bg|text|border|ring)-(?:violet|indigo|fuchsia)-/);
    expect(source).not.toContain("bg-gradient-");
    expect(source).not.toContain("from-");
    expect(source).not.toContain("via-");
    expect(source).not.toContain("to-");
  });

  it("preserves one-click profile switching and recovery", () => {
    expect(source).toContain("const switchLockRef = useRef(false);");
    expect(source).toContain("switchLockRef.current");
    expect(source).toContain("switchLockRef.current = true;");
    expect(source).toContain("await switchAccount(profileId);");
    expect(source).toContain("setActiveProfileId(profileId);");
    expect(source).toContain("switchLockRef.current = false;");
    expect(source).toContain("setSwitchingId(null);");
    expect(source).not.toContain("window.location");
  });

  it("keeps profile management in its existing location", () => {
    expect(source).toContain('href="/accounts"');
    expect(source).toContain('t("manageProfiles")');
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("password");
  });
});
