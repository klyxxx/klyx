import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch7 = read("lib/klyx-i18n-batch-7.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 7 contract", () => {
  it("aggregates the verified Caucasus and Central Asian pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-7"');
    expect(aggregator).toContain("...KLYX_BATCH_7_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_7_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_7_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-7 locale", () => {
    for (const locale of ["ka", "hy", "kk", "uz"]) {
      expect(batch7).toContain(`value: "${locale}"`);
      expect(batch7).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch7).toContain("KLYX_BATCH_7_NAVIGATION_KEYS");
    expect(batch7).toContain(
      "values.length !== KLYX_BATCH_7_NAVIGATION_KEYS.length"
    );
    expect(batch7).toContain(
      'throw new Error("KLYX i18n batch 7 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("ka-GE");
    expect(settings).not.toContain("kk-KZ");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["ka-GE", "ka"]');
    expect(unitTests).toContain('["hy-AM", "hy"]');
    expect(unitTests).toContain('["kk-KZ", "kk"]');
    expect(unitTests).toContain('["uz-UZ", "uz"]');
    expect(unitTests).toContain("requires every batch-7 locale");
    expect(unitTests).toContain('["პარამეტრები", "ka"]');
    expect(unitTests).toContain('["параметрлер", "kk"]');
    expect(unitTests).toContain('["sozlamalar", "uz"]');
    expect(unitTests).toContain('["asetukset", "fi"]');
  });

  it("keeps the batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 7 — Caucasus and Central Asia");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
