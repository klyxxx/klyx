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
const batch1 = read("lib/klyx-i18n-batch-1.ts");
const batch2 = read("lib/klyx-i18n-batch-2.ts");
const provider = read("app/components/KlyxLocaleProvider.tsx");
const settings = read("app/settings/page.tsx");
const e2e = read("tests/e2e/pwa-mobile-accessibility.spec.ts");

describe("KLYX global language batch 2 contract", () => {
  it("aggregates both verified language packs into the canonical locale API", () => {
    expect(aggregator).toContain('from "./klyx-i18n-batch-1"');
    expect(aggregator).toContain('from "./klyx-i18n-batch-2"');
    expect(aggregator).toContain("...KLYX_BATCH_1_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_2_LANGUAGE_OPTIONS");
    expect(aggregator).toContain("...KLYX_BATCH_1_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_2_UI_MESSAGES");
    expect(aggregator).toContain("...KLYX_BATCH_1_NAVIGATION_TRANSLATIONS");
    expect(aggregator).toContain("...KLYX_BATCH_2_NAVIGATION_TRANSLATIONS");
  });

  it("keeps all new selectable locales backed by real pack entries", () => {
    for (const locale of [
      "ru",
      "uk",
      "pl",
      "tr",
      "hi",
      "ur",
      "he",
      "fa",
      "id",
      "vi",
      "th",
      "bn",
    ]) {
      expect(batch2).toContain(`value: "${locale}"`);
      expect(batch2).toContain(`${locale}: {`);
    }

    expect(batch1).toContain('value: "fr"');
    expect(batch1).toContain('value: "zh-hant"');
  });

  it("models right-to-left locales explicitly", () => {
    for (const locale of ["ur", "he", "fa"]) {
      expect(batch2).toMatch(
        new RegExp(`value: "${locale}"[\\s\\S]{0,100}dir: "rtl"`)
      );
    }

    expect(provider).toContain("document.documentElement.dir = metadata.dir");
  });

  it("preserves one canonical selector and locale-independent accessibility E2E", () => {
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(e2e).toContain('page.locator(\'a[href="#klyx-main-content"]\')');
    expect(e2e).not.toContain('name: "Aller au contenu principal"');
  });

  it("keeps legacy browser aliases explicit instead of duplicating options", () => {
    expect(aggregator).toContain('iw: "he"');
    expect(aggregator).toContain('in: "id"');
  });
});
