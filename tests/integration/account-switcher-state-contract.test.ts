import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

const accountSwitcher = read("app/components/AccountSwitcher.tsx");
const activeProfileSync = read("app/components/ActiveProfileSync.tsx");
const accountHome = read("lib/account-home.ts");
const founderModeSwitcher = read("app/components/FounderModeSwitcher.tsx");

describe("KLYX profile switch UI state", () => {
  it("optimistically tracks the confirmed active profile without depending on formatting", () => {
    const source = compact(accountSwitcher);

    expect(source).toContain("activeProfileId");
    expect(source).toContain("setActiveProfileId(profileId);");
    expect(source).toContain("profile.id === activeProfileId");
  });

  it("serializes profile switches before React can rerender", () => {
    const accountSource = compact(accountSwitcher);
    const founderSource = compact(founderModeSwitcher);

    expect(accountSource).toContain("const switchLockRef = useRef(false);");
    expect(accountSource).toContain("switchLockRef.current");
    expect(accountSource).toContain("switchLockRef.current = true;");
    expect(accountSource).toContain("switchLockRef.current = false;");

    expect(founderSource).toContain("const switchLockRef = useRef(false);");
    expect(founderSource).toContain("switchLockRef.current");
    expect(founderSource).toContain("switchLockRef.current = true;");
    expect(founderSource).toContain("switchLockRef.current = false;");
  });

  it("always releases the account switch spinner after success or failure", () => {
    const source = compact(accountSwitcher);

    expect(source).toContain(
      "} finally { switchLockRef.current = false; setSwitchingId(null); }"
    );
  });

  it("hands successful role changes to the canonical full-document profile synchronizer", () => {
    expect(accountSwitcher).toContain(
      "ActiveProfileSync owns the full-document role transition."
    );
    expect(accountSwitcher).not.toContain("window.location");
    expect(activeProfileSync).toContain(
      'import { getKlyxAccountHome } from "@/lib/account-home";'
    );
    expect(activeProfileSync).toContain(
      "getKlyxAccountHome(detail.accountType)"
    );
    expect(activeProfileSync).toContain("window.location.replace(target.toString());");
    expect(accountHome).toContain('client: "/assistant"');
    expect(accountHome).toContain('provider: "/provider/assistant"');
  });

  it("lets the founder client/provider switcher recover the same way", () => {
    expect(founderModeSwitcher).toContain(
      "useState<string | null>(currentProfileId)"
    );
    expect(founderModeSwitcher).toContain("setActiveProfileId(profileId);");
    expect(founderModeSwitcher).toContain("} finally {");
    expect(founderModeSwitcher).toContain("switchLockRef.current = false;");
    expect(founderModeSwitcher).toContain("setSwitching(null);");
    expect(founderModeSwitcher).toContain(
      "clientProfileId === activeProfileId"
    );
    expect(founderModeSwitcher).toContain(
      "providerProfileId === activeProfileId"
    );
  });
});
