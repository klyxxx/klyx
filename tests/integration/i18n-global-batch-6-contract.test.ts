import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch6 = read("lib/klyx-i18n-batch-6.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 6 contract", () => {
  it("aggregates the verified Southeast Asian and African pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-6"');
    expect(aggregator).toContain("...KLYX_BATCH_6_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_6_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_6_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-6 locale", () => {
    for (const locale of ["ms", "fil", "sw", "af"]) {
      expect(batch6).toContain(`value: "${locale}"`);
      expect(batch6).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch6).toContain("KLYX_BATCH_6_NAVIGATION_KEYS");
    expect(batch6).toContain(
      "values.length !== KLYX_BATCH_6_NAVIGATION_KEYS.length"
    );
    expect(batch6).toContain(
      'throw new Error("KLYX i18n batch 6 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("ms-MY");
    expect(settings).not.toContain("sw-KE");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["ms-MY", "ms"]');
    expect(unitTests).toContain('["fil-PH", "fil"]');
    expect(unitTests).toContain('["sw-KE", "sw"]');
    expect(unitTests).toContain('["af-ZA", "af"]');
    expect(unitTests).toContain("requires every batch-6 locale");
    expect(unitTests).toContain('["tetapan", "ms"]');
    expect(unitTests).toContain('["mipangilio", "sw"]');
  });

  it("keeps the batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 6 — Southeast Asia and Africa");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
