import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const bootstrap = readRepoFile("scripts/golden-path-bootstrap.mjs");
const providerFixture = readRepoFile("scripts/golden-path-provider-fixture.mjs");
const intentSearch = readRepoFile("scripts/golden-path-intent-search.mjs");
const universalCatalog = readRepoFile(
  "supabase/migrations/20260814225000_klyx_universal_service_catalog.sql"
);

const goldenScripts = [
  "scripts/golden-path-bootstrap.mjs",
  "scripts/golden-path-provider-fixture.mjs",
  "scripts/golden-path-intent-search.mjs",
];

describe("KLYX canonical service golden-path fixture", () => {
  it("keeps the affected golden-path scripts syntactically valid", () => {
    for (const file of goldenScripts) {
      expect(() =>
        execFileSync(process.execPath, ["--check", repoPath(file)], {
          stdio: "pipe",
        })
      ).not.toThrow();
    }
  });

  it("uses the canonical home-cleaning slug seeded by the universal catalog", () => {
    expect(universalCatalog).toContain("'Ménage à domicile', 'menage-a-domicile'");

    for (const source of [bootstrap, providerFixture, intentSearch]) {
      expect(source).toContain('"menage-a-domicile"');
    }
  });

  it("prefers the canonical slug before legacy aliases during fixture selection", () => {
    for (const source of [bootstrap, providerFixture]) {
      expect(source.indexOf('"menage-a-domicile"')).toBeGreaterThanOrEqual(0);
      expect(source.indexOf('"cleaning"')).toBeGreaterThanOrEqual(0);
      expect(source.indexOf('"menage-a-domicile"')).toBeLessThan(
        source.indexOf('"cleaning"')
      );
      expect(source).toContain("for (const slug of CLEANING_SERVICE_SLUGS)");
      expect(source).toContain("candidate.slug === slug");
    }
  });

  it("keeps legacy aliases only as compatibility fallbacks", () => {
    for (const source of [bootstrap, providerFixture, intentSearch]) {
      expect(source).toContain('"cleaning"');
      expect(source).toContain('"menage"');
      expect(source).toContain('"ménage"');
    }
  });
});
