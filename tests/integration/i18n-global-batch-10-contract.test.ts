import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch10 = read("lib/klyx-i18n-batch-10.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n-batch-10.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 10 contract", () => {
  it("aggregates the verified Southeast and Central Asian pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-10"');
    expect(aggregator).toContain("...KLYX_BATCH_10_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_10_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_10_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-10 locale", () => {
    for (const locale of ["my", "km", "lo", "mn"]) {
      expect(batch10).toContain(`value: "${locale}"`);
      expect(batch10).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch10).toContain("KLYX_BATCH_10_NAVIGATION_KEYS");
    expect(batch10).toContain(
      "values.length !== KLYX_BATCH_10_NAVIGATION_KEYS.length"
    );
    expect(batch10).toContain(
      'throw new Error("KLYX i18n batch 10 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("my-MM");
    expect(settings).not.toContain("mn-MN");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["my-MM", "my"]');
    expect(unitTests).toContain('["km-KH", "km"]');
    expect(unitTests).toContain('["lo-LA", "lo"]');
    expect(unitTests).toContain('["mn-MN", "mn"]');
    expect(unitTests).toContain("requires every batch-10 locale");
    expect(unitTests).toContain('["ဆက်တင်များ", "my"]');
    expect(unitTests).toContain('["ការកំណត់", "km"]');
    expect(unitTests).toContain('["ການຕັ້ງຄ່າ", "lo"]');
    expect(unitTests).toContain('["тохиргоо", "mn"]');
  });

  it("keeps the batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 10 — Southeast and Central Asia");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
