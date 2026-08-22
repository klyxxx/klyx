import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch5 = read("lib/klyx-i18n-batch-5.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 5 contract", () => {
  it("aggregates the verified Baltic and Slovenian pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-5"');
    expect(aggregator).toContain("...KLYX_BATCH_5_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_5_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_5_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-5 locale", () => {
    for (const locale of ["lt", "lv", "et", "sl"]) {
      expect(batch5).toContain(`value: "${locale}"`);
      expect(batch5).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch5).toContain("KLYX_BATCH_5_NAVIGATION_KEYS");
    expect(batch5).toContain(
      "values.length !== KLYX_BATCH_5_NAVIGATION_KEYS.length"
    );
    expect(batch5).toContain(
      'throw new Error("KLYX i18n batch 5 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("lt-LT");
    expect(settings).not.toContain("sl-SI");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["lt-LT", "lt"]');
    expect(unitTests).toContain('["sl-SI", "sl"]');
    expect(unitTests).toContain("requires every batch-5 locale");
    expect(unitTests).toContain('["nustatymai", "lt"]');
    expect(unitTests).toContain('["nastavitve", "sl"]');
  });

  it("keeps the Baltic and Slovenian batch documented honestly", () => {
    expect(documentation).toContain("### Batch 5 — Baltics and Slovenia");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
