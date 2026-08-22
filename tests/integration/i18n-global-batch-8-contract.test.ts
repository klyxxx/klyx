import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch8 = read("lib/klyx-i18n-batch-8.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 8 contract", () => {
  it("aggregates the verified South Asian pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-8"');
    expect(aggregator).toContain("...KLYX_BATCH_8_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_8_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_8_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-8 locale", () => {
    for (const locale of ["ta", "te", "mr", "ne"]) {
      expect(batch8).toContain(`value: "${locale}"`);
      expect(batch8).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch8).toContain("KLYX_BATCH_8_NAVIGATION_KEYS");
    expect(batch8).toContain(
      "values.length !== KLYX_BATCH_8_NAVIGATION_KEYS.length"
    );
    expect(batch8).toContain(
      'throw new Error("KLYX i18n batch 8 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("ta-IN");
    expect(settings).not.toContain("ne-NP");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["ta-IN", "ta"]');
    expect(unitTests).toContain('["te-IN", "te"]');
    expect(unitTests).toContain('["mr-IN", "mr"]');
    expect(unitTests).toContain('["ne-NP", "ne"]');
    expect(unitTests).toContain("requires every batch-8 locale");
    expect(unitTests).toContain('["அமைப்புகள்", "ta"]');
    expect(unitTests).toContain('["సెట్టింగ్‌లు", "te"]');
    expect(unitTests).toContain('["सेटिंग्ज", "mr"]');
    expect(unitTests).toContain('["सेटिङहरू", "ne"]');
    expect(unitTests).toContain('["asetukset", "fi"]');
  });

  it("keeps the batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 8 — South Asia");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
