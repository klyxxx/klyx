import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("global account switch serialization contract", () => {
  it("allows only one active profile mutation at a time", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/account-switcher.ts"),
      "utf8"
    );

    expect(source).toContain(
      "let activeProfileSwitchPromise: Promise<void> | null = null;"
    );
    expect(source).toContain("if (activeProfileSwitchPromise)");
    expect(source).toContain(
      "Un changement de profil KLYX est déjà en cours."
    );
    expect(source).toContain(
      "const pendingSwitch = performAccountSwitch(profileId);"
    );
    expect(source).toContain(
      "activeProfileSwitchPromise = pendingSwitch;"
    );
    expect(source).toContain(
      "if (activeProfileSwitchPromise === pendingSwitch)"
    );
    expect(source).toContain("activeProfileSwitchPromise = null;");
  });

  it("emits the role transition only after the server confirms the switch", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/account-switcher.ts"),
      "utf8"
    );

    const fetchIndex = source.indexOf(
      'fetch("/api/profiles/active"'
    );
    const responseGuardIndex = source.indexOf("if (!response.ok)", fetchIndex);
    const emitIndex = source.indexOf(
      "emitActiveProfileChanged(profileId, result.accountType);",
      fetchIndex
    );

    expect(fetchIndex).toBeGreaterThanOrEqual(0);
    expect(responseGuardIndex).toBeGreaterThan(fetchIndex);
    expect(emitIndex).toBeGreaterThan(responseGuardIndex);
  });
});
