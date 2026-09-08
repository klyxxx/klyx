import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  KLYX_FULLY_TRANSLATED_LOCALES,
  KLYX_LANGUAGE_OPTIONS,
  KLYX_LOCALES,
} from "@/lib/klyx-i18n";
import {
  KLYX_TOLGEE_CLI_VERSION,
  KLYX_TOLGEE_MANAGED_LOCALES,
  KLYX_TOLGEE_PUBLISHED_LOCALES,
  KLYX_TOLGEE_STAGED_LOCALES,
  KLYX_TOLGEE_TRANSLATIONS_DIRECTORY,
  isKlyxTolgeePublishedLocale,
  isKlyxTolgeeStagedLocale,
} from "@/lib/klyx-tolgee";

const KLYX_TOLGEE_PROJECT_ID = 34751;

describe("KLYX Tolgee foundation", () => {
  it("manages every locale already registered by KLYX", () => {
    expect(KLYX_TOLGEE_MANAGED_LOCALES).toEqual(KLYX_LOCALES);
    expect(new Set(KLYX_TOLGEE_MANAGED_LOCALES).size).toBe(
      KLYX_TOLGEE_MANAGED_LOCALES.length
    );
  });

  it("publishes only fully certified KLYX locales", () => {
    expect(KLYX_TOLGEE_PUBLISHED_LOCALES).toEqual(
      KLYX_FULLY_TRANSLATED_LOCALES
    );

    expect(KLYX_LANGUAGE_OPTIONS.map((option) => option.value)).toEqual(
      KLYX_TOLGEE_PUBLISHED_LOCALES
    );

    expect(isKlyxTolgeePublishedLocale("fr")).toBe(true);
    expect(isKlyxTolgeePublishedLocale("es")).toBe(false);
    expect(isKlyxTolgeeStagedLocale("es")).toBe(true);
    expect(KLYX_TOLGEE_STAGED_LOCALES).toContain("es");
  });

  it("partitions managed locales cleanly between published and staged", () => {
    const published = new Set(KLYX_TOLGEE_PUBLISHED_LOCALES);
    const staged = new Set(KLYX_TOLGEE_STAGED_LOCALES);

    for (const locale of KLYX_TOLGEE_MANAGED_LOCALES) {
      expect(published.has(locale) || staged.has(locale)).toBe(true);
      expect(published.has(locale) && staged.has(locale)).toBe(false);
    }
  });

  it("keeps Tolgee CLI pinned, the Cloud project explicit and credentials out of repository config", () => {
    const packageJson = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const tolgeeConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), ".tolgeerc.json"), "utf8")
    ) as {
      apiKey?: string;
      projectId?: number | string;
      pull?: {
        path?: string;
        languages?: string[];
      };
      push?: {
        forceMode?: string;
      };
    };

    expect(KLYX_TOLGEE_CLI_VERSION).toBe("2.20.0");
    expect(KLYX_TOLGEE_TRANSLATIONS_DIRECTORY).toBe("messages/tolgee");

    for (const scriptName of [
      "i18n:tolgee:pull",
      "i18n:tolgee:push",
      "i18n:tolgee:watch",
    ]) {
      expect(packageJson.scripts?.[scriptName]).toContain(
        `@tolgee/cli@${KLYX_TOLGEE_CLI_VERSION}`
      );
    }

    expect(packageJson.dependencies?.["@tolgee/cli"]).toBeUndefined();
    expect(packageJson.devDependencies?.["@tolgee/cli"]).toBeUndefined();

    expect(tolgeeConfig.apiKey).toBeUndefined();
    expect(tolgeeConfig.projectId).toBe(KLYX_TOLGEE_PROJECT_ID);
    expect(tolgeeConfig.pull?.path).toBe("./messages/tolgee");
    expect(tolgeeConfig.pull?.languages).toBeUndefined();
    expect(tolgeeConfig.push?.forceMode).toBe("NO_FORCE");
  });
});
