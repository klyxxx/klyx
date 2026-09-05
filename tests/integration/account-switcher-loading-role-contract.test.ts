import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("account switcher loading role contract", () => {
  it("never presents an unresolved profile as client", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");
    const i18n = read("lib/klyx-account-switcher-i18n.ts");

    expect(switcher).toMatch(/if \(!profile\) return loadingLabel;/);
    expect(switcher).toMatch(/loading \|\| switchingId \? \(/);
    expect(switcher).toMatch(/disabled=\{loading \|\| switchingId !== null\}/);

    for (const localeText of [
      "Chargement du profil…",
      "Loading profile…",
      "Profiel laden…",
      "Profil wird geladen…",
    ]) {
      expect(i18n).toContain(localeText);
    }
  });
});
