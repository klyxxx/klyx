import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const accountSwitcher = read("app/components/AccountSwitcher.tsx");
const founderModeSwitcher = read("app/components/FounderModeSwitcher.tsx");

describe("KLYX profile switch UI state", () => {
  it("optimistically tracks the confirmed active profile instead of waiting for a server remount", () => {
    expect(accountSwitcher).toContain("activeProfileId");
    expect(accountSwitcher).toContain("setActiveProfileId(\n        profileId\n      );");
    expect(accountSwitcher).toContain("profile.id ===\n        activeProfileId");
    expect(accountSwitcher).toContain("profile.id ===\n                    activeProfileId");
  });

  it("always releases the account switch spinner after success or failure", () => {
    const finallyIndex = accountSwitcher.indexOf("} finally {");
    const releaseIndex = accountSwitcher.indexOf(
      "setSwitchingId(\n        null\n      );",
      finallyIndex
    );

    expect(finallyIndex).toBeGreaterThanOrEqual(0);
    expect(releaseIndex).toBeGreaterThan(finallyIndex);
  });

  it("lets the founder client/provider switcher recover the same way", () => {
    expect(founderModeSwitcher).toContain(
      "useState<string | null>(currentProfileId)"
    );
    expect(founderModeSwitcher).toContain("setActiveProfileId(profileId);");
    expect(founderModeSwitcher).toContain("} finally {");
    expect(founderModeSwitcher).toContain("setSwitching(null);");
    expect(founderModeSwitcher).toContain(
      "clientProfileId === activeProfileId"
    );
    expect(founderModeSwitcher).toContain(
      "providerProfileId === activeProfileId"
    );
  });
});
