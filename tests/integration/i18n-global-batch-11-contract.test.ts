import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch11 = read("lib/klyx-i18n-batch-11.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n-batch-11.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 11 contract", () => {
  it("aggregates the verified European extension pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-11"');
    expect(aggregator).toContain("...KLYX_BATCH_11_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_11_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_11_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-11 locale", () => {
    for (const locale of ["sq", "mk", "is", "ga"]) {
      expect(batch11).toContain(`value: "${locale}"`);
      expect(batch11).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch11).toContain("KLYX_BATCH_11_NAVIGATION_KEYS");
    expect(batch11).toContain(
      "values.length !== KLYX_BATCH_11_NAVIGATION_KEYS.length"
    );
    expect(batch11).toContain(
      'throw new Error("KLYX i18n batch 11 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("sq-AL");
    expect(settings).not.toContain("ga-IE");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["sq-AL", "sq"]');
    expect(unitTests).toContain('["mk-MK", "mk"]');
    expect(unitTests).toContain('["is-IS", "is"]');
    expect(unitTests).toContain('["ga-IE", "ga"]');
    expect(unitTests).toContain("requires every batch-11 locale");
    expect(unitTests).toContain('["cilësimet", "sq"]');
    expect(unitTests).toContain('["поставки", "mk"]');
    expect(unitTests).toContain('["stillingar", "is"]');
    expect(unitTests).toContain('["socruithe", "ga"]');
  });

  it("keeps the batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 11 — Europe extension");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
