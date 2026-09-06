import { readFileSync } from "node:fs";
import path from "node:path";

import deCatalog from "@/messages/tolgee/de.json";
import enCatalog from "@/messages/tolgee/en.json";
import esCatalog from "@/messages/tolgee/es.json";
import frCatalog from "@/messages/tolgee/fr.json";
import nlCatalog from "@/messages/tolgee/nl.json";
import { describe, expect, it } from "vitest";

import {
  translateKlyxUi,
  type KlyxSelectableLocale,
  type KlyxUiMessageKey,
} from "@/lib/klyx-i18n";
import {
  KLYX_TOLGEE_RUNTIME_CATALOGS,
  getKlyxTolgeeRuntimeUiTranslation,
  translateKlyxTolgeeRuntimeUi,
} from "@/lib/klyx-tolgee-runtime";
import {
  KLYX_TOLGEE_PUBLISHED_LOCALES,
  KLYX_TOLGEE_STAGED_LOCALES,
} from "@/lib/klyx-tolgee";

const SOURCE_CATALOGS = {
  fr: frCatalog,
  en: enCatalog,
  nl: nlCatalog,
  de: deCatalog,
} satisfies Record<KlyxSelectableLocale, Readonly<Record<string, string>>>;

function getUiEntries(catalog: Readonly<Record<string, string>>) {
  return Object.entries(catalog).filter(([key]) => key.startsWith("ui."));
}

describe("KLYX Tolgee runtime bridge", () => {
  it("serves every published shell UI key from committed Tolgee snapshots", () => {
    expect(Object.keys(KLYX_TOLGEE_RUNTIME_CATALOGS).sort()).toEqual(
      [...KLYX_TOLGEE_PUBLISHED_LOCALES].sort()
    );

    for (const locale of KLYX_TOLGEE_PUBLISHED_LOCALES) {
      const entries = getUiEntries(SOURCE_CATALOGS[locale]);
      expect(entries.length).toBeGreaterThan(0);

      for (const [fullKey, value] of entries) {
        const key = fullKey.slice(3) as KlyxUiMessageKey;

        expect(getKlyxTolgeeRuntimeUiTranslation(locale, key)).toBe(value);
        expect(translateKlyxTolgeeRuntimeUi(locale, key)).toBe(value);
        expect(value).toBe(translateKlyxUi(locale, key));
      }
    }
  });

  it("keeps staged Spanish data outside the published Tolgee runtime catalog", () => {
    expect(KLYX_TOLGEE_STAGED_LOCALES).toContain("es");
    expect(Object.keys(KLYX_TOLGEE_RUNTIME_CATALOGS)).not.toContain("es");
    expect(esCatalog["ui.sidebar.logout"]).toBe("Cerrar sesión");
    expect(
      getKlyxTolgeeRuntimeUiTranslation("es", "sidebar.logout")
    ).toBeNull();
    expect(translateKlyxTolgeeRuntimeUi("es", "sidebar.logout")).toBe(
      translateKlyxUi("es", "sidebar.logout")
    );
  });

  it("wires KlyxLocaleProvider through the static Tolgee bridge without network secrets", () => {
    const providerSource = readFileSync(
      path.resolve(process.cwd(), "app/components/KlyxLocaleProvider.tsx"),
      "utf8"
    );
    const runtimeSource = readFileSync(
      path.resolve(process.cwd(), "lib/klyx-tolgee-runtime.ts"),
      "utf8"
    );

    expect(providerSource).toContain("translateKlyxTolgeeRuntimeUi");
    expect(providerSource).toContain("normalizeKlyxSelectableLocale");
    expect(providerSource).not.toContain("t: (key) => translateKlyxUi(locale, key)");

    expect(runtimeSource).not.toContain("TOLGEE_API_KEY");
    expect(runtimeSource).not.toContain("NEXT_PUBLIC_TOLGEE");
    expect(runtimeSource).not.toContain("process.env");
    expect(runtimeSource).not.toContain("fetch(");
  });
});
