import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

const aggregator = read("lib/klyx-i18n.ts");
const batch3 = read("lib/klyx-i18n-batch-3.ts");
const settings = read("app/settings/page.tsx");
const unitTests = read("tests/unit/klyx-i18n.test.ts");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX global language batch 3 contract", () => {
  it("aggregates the verified Nordic language pack into the canonical locale API", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-3"');
    expect(aggregator).toContain("...KLYX_BATCH_3_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_3_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_3_NAVIGATION_TRANSLATIONS");
  });

  it("ships real selectable entries for all four Nordic locales", () => {
    for (const locale of ["sv", "da", "no", "fi"]) {
      expect(batch3).toContain(`value: "${locale}"`);
      expect(batch3).toContain(`${locale}: {`);
    }
  });

  it("fails closed if a Nordic navigation catalog has the wrong canonical key count", () => {
    expect(batch3).toContain("KLYX_BATCH_3_NAVIGATION_KEYS");
    expect(batch3).toContain(
      "values.length !== KLYX_BATCH_3_NAVIGATION_KEYS.length"
    );
    expect(batch3).toContain(
      'throw new Error("KLYX i18n batch 3 navigation catalog is incomplete.")'
    );
  });

  it("keeps the language selector driven by one canonical catalog", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).not.toContain("sv-SE");
    expect(settings).not.toContain("fi-FI");
  });

  it("requires runtime normalization, translated search and pack completeness tests", () => {
    expect(unitTests).toContain('["sv-SE", "sv"]');
    expect(unitTests).toContain('["fi-FI", "fi"]');
    expect(unitTests).toContain("requires every batch-3 locale");
    expect(unitTests).toContain('["inställningar", "sv"]');
    expect(unitTests).toContain('["asetukset", "fi"]');
  });

  it("keeps the Nordic batch documented without claiming full-site translation", () => {
    expect(documentation).toContain("### Batch 3 — Nordics");
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain(
      "Significant page-level coverage is still incomplete"
    );
    expect(documentation).toContain(
      "FR/EN/NL/DE currently have the deepest reviewed page-level coverage"
    );
  });
});
