import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/components/FounderModeSwitcher.tsx"),
  "utf8"
);

describe("KLYX FounderModeSwitcher theme contract", () => {
  it("inherits the semantic KLYX primary accent for active client and provider modes", () => {
    expect(source.match(/bg-primary text-primary-foreground/g)?.length).toBe(2);
    expect(source).not.toContain("#2563EB");
    expect(source).not.toMatch(/(?:bg|text|border|ring)-(?:blue|violet|indigo|fuchsia)-/);
    expect(source).not.toContain("bg-gradient-");
    expect(source).not.toContain("from-");
    expect(source).not.toContain("via-");
    expect(source).not.toContain("to-");
  });

  it("preserves the one-click profile switch contract", () => {
    expect(source).toContain("const switchLockRef = useRef(false);");
    expect(source).toContain("switchLockRef.current = true;");
    expect(source).toContain('fetch(\n        "/api/profiles/active"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain("body: JSON.stringify({\n            profileId,");
    expect(source).toContain("setActiveProfileId(profileId);");
    expect(source).toContain("switchLockRef.current = false;");
    expect(source).toContain("setSwitching(null);");
  });

  it("preserves the client and provider destinations", () => {
    expect(source).toContain('mode === "provider"');
    expect(source).toContain('"/provider"');
    expect(source).toContain('"/dashboard"');
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("password");
  });
});
