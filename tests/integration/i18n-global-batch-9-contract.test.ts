import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const aggregator = read("lib/klyx-i18n.ts");
const batch9 = read("lib/klyx-i18n-batch-9.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n-batch-9.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 9 contract", () => {
  it("aggregates the verified South Asian extension pack", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-9"');
    expect(aggregator).toContain("...KLYX_BATCH_9_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_9_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_9_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for every batch-9 locale", () => {
    for (const locale of ["si", "pa", "gu", "kn"]) {
      expect(batch9).toContain(`value: "${locale}"`);
      expect(batch9).toContain(`${locale}: {`);
    }
  });

  it("fails closed when the canonical navigation catalog is incomplete", () => {
    expect(batch9).toContain("KLYX_BATCH_9_NAVIGATION_KEYS");
    expect(batch9).toContain(
      "values.length !== KLYX_BATCH_9_NAVIGATION_KEYS.length"
    );
    expect(batch9).toContain(
      'throw new Error("KLYX i18n batch 9 navigation catalog is incomplete.")'
    );
  });

  it("keeps Settings driven by the canonical locale catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("si-LK");
    expect(settings).not.toContain("kn-IN");
  });

  it("requires normalization, translated search and full pack completeness tests", () => {
    expect(unitTests).toContain('["si-LK", "si"]');
    expect(unitTests).toContain('["pa-IN", "pa"]');
    expect(unitTests).toContain('["gu-IN", "gu"]');
    expect(unitTests).toContain('["kn-IN", "kn"]');
    expect(unitTests).toContain("requires every batch-9 locale");
    expect(unitTests).toContain('["සැකසුම්", "si"]');
    expect(unitTests).toContain('["ਸੈਟਿੰਗਾਂ", "pa"]');
    expect(unitTests).toContain('["સેટિંગ્સ", "gu"]');
    expect(unitTests).toContain('["ಸೆಟ್ಟಿಂಗ್‌ಗಳು", "kn"]');
  });

  it("keeps the batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 9 — South Asia extension");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
  });
});
