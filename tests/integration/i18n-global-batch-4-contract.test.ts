import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch4 = read("lib/klyx-i18n-batch-4.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 4 contract", () => {
  it("aggregates the verified Central European and Balkan pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-4"');
    expect(aggregator).toContain("...KLYX_BATCH_4_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_4_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_4_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-4 locale", () => {
    for (const locale of ["cs", "sk", "hu", "ro", "el", "bg", "hr", "sr"]) {
      expect(batch4).toContain(`value: "${locale}"`);
      expect(batch4).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch4).toContain("KLYX_BATCH_4_NAVIGATION_KEYS");
    expect(batch4).toContain(
      "values.length !== KLYX_BATCH_4_NAVIGATION_KEYS.length"
    );
    expect(batch4).toContain(
      'throw new Error("KLYX i18n batch 4 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("cs-CZ");
    expect(settings).not.toContain("sr-RS");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["cs-CZ", "cs"]');
    expect(unitTests).toContain('["sr-RS", "sr"]');
    expect(unitTests).toContain("requires every batch-4 locale");
    expect(unitTests).toContain('["nastavení", "cs"]');
    expect(unitTests).toContain('["подешавања", "sr"]');
  });

  it("documents 36 shell locales without claiming full-site translation", () => {
    expect(documentation).toContain("36 selectable locales");
    expect(documentation).toContain("### Batch 4 — Central Europe and Balkans");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
