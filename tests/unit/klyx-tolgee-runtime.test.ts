import { readFileSync } from "node:fs";
import path from "node:path";

import deCatalog from "@/messages/tolgee/de.json";
import enCatalog from "@/messages/tolgee/en.json";
import esCatalog from "@/messages/tolgee/es.json";
import frCatalog from "@/messages/tolgee/fr.json";
import nlCatalog from "@/messages/tolgee/nl.json";
import { describe, expect, it } from "vitest";

import {
  translateKlyxNavigationLabel,
  translateKlyxUi,
  type KlyxSelectableLocale,
  type KlyxUiMessageKey,
} from "@/lib/klyx-i18n";
import {
  KLYX_TOLGEE_ONLY_UI_MESSAGE_KEYS,
  KLYX_TOLGEE_RUNTIME_CATALOGS,
  getKlyxTolgeeRuntimeNavigationTranslation,
  getKlyxTolgeeRuntimeUiTranslation,
  translateKlyxTolgeeRuntimeNavigation,
  translateKlyxTolgeeRuntimeUi,
  type KlyxTolgeeUiMessageKey,
} from "@/lib/klyx-tolgee-runtime";
import {
  KLYX_TOLGEE_PUBLISHED_LOCALES,
  KLYX_TOLGEE_STAGED_LOCALES,
} from "@/lib/klyx-tolgee";

const SOURCE_CATALOGS: Record<
  KlyxSelectableLocale,
  Readonly<Record<string, string>>
> = {
  fr: frCatalog,
  en: enCatalog,
  nl: nlCatalog,
  de: deCatalog,
};

const TOLGEE_ONLY_UI_KEY_SET = new Set<string>(
  KLYX_TOLGEE_ONLY_UI_MESSAGE_KEYS
);

const EXPECTED_NAVIGATION_LABELS = {
  fr: {
    desktopNavigation: "Navigation principale KLYX",
    mobileNavigation: "Navigation mobile KLYX",
  },
  en: {
    desktopNavigation: "Main KLYX navigation",
    mobileNavigation: "Mobile KLYX navigation",
  },
  nl: {
    desktopNavigation: "Hoofdnavigatie van KLYX",
    mobileNavigation: "Mobiele KLYX-navigatie",
  },
  de: {
    desktopNavigation: "KLYX-Hauptnavigation",
    mobileNavigation: "Mobile KLYX-Navigation",
  },
} satisfies Record<
  KlyxSelectableLocale,
  { desktopNavigation: string; mobileNavigation: string }
>;

const EXPECTED_VOICE_COPY = {
  fr: {
    "assistant.voice.label": "Voix",
    "assistant.voice.stop": "Arrêter la saisie vocale",
    "assistant.voice.unavailable":
      "La saisie vocale n’est pas prise en charge par ce navigateur.",
    "assistant.voice.failed":
      "Impossible d’utiliser la saisie vocale pour le moment.",
    "assistant.voice.permissionDenied":
      "Autorisez l’accès au microphone pour utiliser la saisie vocale.",
    "assistant.voice.noMicrophone":
      "Aucun microphone utilisable n’a été détecté.",
    "assistant.voice.noSpeech": "Aucune parole n’a été détectée. Réessayez.",
    "assistant.voice.secureContextRequired":
      "La saisie vocale nécessite une connexion HTTPS sécurisée.",
  },
  en: {
    "assistant.voice.label": "Voice",
    "assistant.voice.stop": "Stop voice input",
    "assistant.voice.unavailable":
      "Voice input is not supported by this browser.",
    "assistant.voice.failed": "Voice input is unavailable right now.",
    "assistant.voice.permissionDenied":
      "Allow microphone access to use voice input.",
    "assistant.voice.noMicrophone": "No usable microphone was detected.",
    "assistant.voice.noSpeech": "No speech was detected. Try again.",
    "assistant.voice.secureContextRequired":
      "Voice input requires a secure HTTPS connection.",
  },
  nl: {
    "assistant.voice.label": "Spraak",
    "assistant.voice.stop": "Spraakinvoer stoppen",
    "assistant.voice.unavailable":
      "Spraakinvoer wordt niet ondersteund door deze browser.",
    "assistant.voice.failed": "Spraakinvoer is momenteel niet beschikbaar.",
    "assistant.voice.permissionDenied":
      "Sta microfoontoegang toe om spraakinvoer te gebruiken.",
    "assistant.voice.noMicrophone":
      "Er is geen bruikbare microfoon gedetecteerd.",
    "assistant.voice.noSpeech":
      "Er werd geen spraak gedetecteerd. Probeer opnieuw.",
    "assistant.voice.secureContextRequired":
      "Spraakinvoer vereist een beveiligde HTTPS-verbinding.",
  },
  de: {
    "assistant.voice.label": "Sprache",
    "assistant.voice.stop": "Spracheingabe stoppen",
    "assistant.voice.unavailable":
      "Spracheingabe wird von diesem Browser nicht unterstützt.",
    "assistant.voice.failed": "Spracheingabe ist derzeit nicht verfügbar.",
    "assistant.voice.permissionDenied":
      "Erlauben Sie den Mikrofonzugriff für die Spracheingabe.",
    "assistant.voice.noMicrophone":
      "Es wurde kein nutzbares Mikrofon erkannt.",
    "assistant.voice.noSpeech":
      "Es wurde keine Sprache erkannt. Versuchen Sie es erneut.",
    "assistant.voice.secureContextRequired":
      "Spracheingabe erfordert eine sichere HTTPS-Verbindung.",
  },
} satisfies Record<KlyxSelectableLocale, Record<string, string>>;

const EXPECTED_APP_SIDEBAR_NAVIGATION = {
  fr: {
    "Mon activité": "Mon activité",
    Messages: "Messages",
    "Mon profil": "Mon profil",
    "Missions disponibles": "Missions disponibles",
    Services: "Services",
    Finance: "Finance",
  },
  en: {
    "Mon activité": "My business",
    Messages: "Messages",
    "Mon profil": "My profile",
    "Missions disponibles": "Available jobs",
    Services: "Services",
    Finance: "Finance",
  },
  nl: {
    "Mon activité": "Mijn activiteit",
    Messages: "Berichten",
    "Mon profil": "Mijn profiel",
    "Missions disponibles": "Beschikbare opdrachten",
    Services: "Diensten",
    Finance: "Financiën",
  },
  de: {
    "Mon activité": "Mein Geschäft",
    Messages: "Nachrichten",
    "Mon profil": "Mein Profil",
    "Missions disponibles": "Verfügbare Aufträge",
    Services: "Services",
    Finance: "Finanzen",
  },
} satisfies Record<KlyxSelectableLocale, Record<string, string>>;

function getUiEntries(catalog: Readonly<Record<string, string>>) {
  return Object.entries(catalog).filter(([key]) => key.startsWith("ui."));
}

describe("KLYX Tolgee runtime bridge", () => {
  it("serves every published shell UI key from committed Tolgee snapshots", () => {
    expect(Object.keys(KLYX_TOLGEE_RUNTIME_CATALOGS).sort()).toEqual(
      [...KLYX_TOLGEE_PUBLISHED_LOCALES].sort()
    );

    for (const locale of KLYX_TOLGEE_PUBLISHED_LOCALES) {
      const publishedLocale = locale as KlyxSelectableLocale;
      const entries = getUiEntries(SOURCE_CATALOGS[publishedLocale]);
      expect(entries.length).toBeGreaterThan(0);

      for (const [fullKey, value] of entries) {
        const key = fullKey.slice(3) as KlyxTolgeeUiMessageKey;

        expect(getKlyxTolgeeRuntimeUiTranslation(locale, key)).toBe(value);
        expect(translateKlyxTolgeeRuntimeUi(locale, key)).toBe(value);

        if (!TOLGEE_ONLY_UI_KEY_SET.has(key)) {
          expect(value).toBe(
            translateKlyxUi(locale, key as KlyxUiMessageKey)
          );
        }
      }
    }
  });

  it("serves migrated sidebar and assistant voice copy only from committed Tolgee catalogs", () => {
    expect(KLYX_TOLGEE_ONLY_UI_MESSAGE_KEYS).toEqual([
      "sidebar.desktopNavigation",
      "sidebar.mobileNavigation",
      "assistant.voice.label",
      "assistant.voice.stop",
      "assistant.voice.unavailable",
      "assistant.voice.failed",
      "assistant.voice.permissionDenied",
      "assistant.voice.noMicrophone",
      "assistant.voice.noSpeech",
      "assistant.voice.secureContextRequired",
    ]);

    for (const locale of KLYX_TOLGEE_PUBLISHED_LOCALES) {
      const publishedLocale = locale as KlyxSelectableLocale;
      const expectedNavigation = EXPECTED_NAVIGATION_LABELS[publishedLocale];
      const expectedVoice = EXPECTED_VOICE_COPY[publishedLocale];

      expect(
        SOURCE_CATALOGS[publishedLocale]["ui.sidebar.desktopNavigation"]
      ).toBe(expectedNavigation.desktopNavigation);
      expect(
        SOURCE_CATALOGS[publishedLocale]["ui.sidebar.mobileNavigation"]
      ).toBe(expectedNavigation.mobileNavigation);
      expect(
        translateKlyxTolgeeRuntimeUi(locale, "sidebar.desktopNavigation")
      ).toBe(expectedNavigation.desktopNavigation);
      expect(
        translateKlyxTolgeeRuntimeUi(locale, "sidebar.mobileNavigation")
      ).toBe(expectedNavigation.mobileNavigation);

      for (const [key, expected] of Object.entries(expectedVoice)) {
        expect(SOURCE_CATALOGS[publishedLocale][`ui.${key}`]).toBe(expected);
        expect(
          translateKlyxTolgeeRuntimeUi(locale, key as KlyxTolgeeUiMessageKey)
        ).toBe(expected);
      }
    }

    expect(
      translateKlyxTolgeeRuntimeUi("es", "sidebar.desktopNavigation")
    ).toBe("Navigation principale KLYX");
    expect(
      translateKlyxTolgeeRuntimeUi("es", "sidebar.mobileNavigation")
    ).toBe("Navigation mobile KLYX");
    expect(translateKlyxTolgeeRuntimeUi("es", "assistant.voice.label")).toBe(
      "Voix"
    );
  });

  it("serves AppSidebar business navigation from published Tolgee catalogs", () => {
    for (const locale of KLYX_TOLGEE_PUBLISHED_LOCALES) {
      const publishedLocale = locale as KlyxSelectableLocale;
      const expectedLabels = EXPECTED_APP_SIDEBAR_NAVIGATION[publishedLocale];

      for (const [frenchLabel, expected] of Object.entries(expectedLabels)) {
        expect(
          SOURCE_CATALOGS[publishedLocale][`navigation.${frenchLabel}`]
        ).toBe(expected);
        expect(
          getKlyxTolgeeRuntimeNavigationTranslation(locale, frenchLabel)
        ).toBe(expected);
        expect(
          translateKlyxTolgeeRuntimeNavigation(locale, frenchLabel)
        ).toBe(expected);
      }
    }
  });

  it("falls back to the legacy navigation translator when a Tolgee key is missing", () => {
    for (const locale of KLYX_TOLGEE_PUBLISHED_LOCALES) {
      const publishedLocale = locale as KlyxSelectableLocale;

      expect(SOURCE_CATALOGS[publishedLocale]["navigation.KLYX"]).toBeUndefined();
      expect(
        getKlyxTolgeeRuntimeNavigationTranslation(locale, "KLYX")
      ).toBeNull();
      expect(translateKlyxTolgeeRuntimeNavigation(locale, "KLYX")).toBe(
        translateKlyxNavigationLabel(locale, "KLYX")
      );
      expect(translateKlyxTolgeeRuntimeNavigation(locale, "KLYX")).toBe("KLYX");
    }
  });

  it("keeps staged navigation catalogs outside the published runtime bridge", () => {
    expect(KLYX_TOLGEE_STAGED_LOCALES).toContain("es");
    expect(Object.keys(KLYX_TOLGEE_RUNTIME_CATALOGS)).not.toContain("es");
    expect(typeof esCatalog["navigation.Mon activité"]).toBe("string");
    expect(
      getKlyxTolgeeRuntimeNavigationTranslation("es", "Mon activité")
    ).toBeNull();
    expect(
      translateKlyxTolgeeRuntimeNavigation("es", "Mon activité")
    ).toBe(translateKlyxNavigationLabel("es", "Mon activité"));
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

  it("wires KlyxLocaleProvider, AppSidebar and AssistantComposer through the static Tolgee bridge", () => {
    const providerSource = readFileSync(
      path.resolve(process.cwd(), "app/components/KlyxLocaleProvider.tsx"),
      "utf8"
    );
    const sidebarSource = readFileSync(
      path.resolve(process.cwd(), "app/ui/AppSidebar.tsx"),
      "utf8"
    );
    const composerSource = readFileSync(
      path.resolve(
        process.cwd(),
        "app/components/assistant/AssistantComposer.tsx"
      ),
      "utf8"
    );
    const runtimeSource = readFileSync(
      path.resolve(process.cwd(), "lib/klyx-tolgee-runtime.ts"),
      "utf8"
    );

    expect(providerSource).toContain("translateKlyxTolgeeRuntimeUi");
    expect(providerSource).toContain("normalizeKlyxSelectableLocale");
    expect(providerSource).toContain("type KlyxTolgeeUiMessageKey");
    expect(providerSource).not.toContain("t: (key) => translateKlyxUi(locale, key)");

    expect(sidebarSource).toContain("const { locale, t } = useKlyxLocale();");
    expect(sidebarSource).toContain(
      'const desktopNavigationLabel = t("sidebar.desktopNavigation");'
    );
    expect(sidebarSource).toContain(
      'const mobileNavigationLabel = t("sidebar.mobileNavigation");'
    );
    expect(sidebarSource).toContain(
      "translateKlyxTolgeeRuntimeNavigation(locale, item.translationLabel)"
    );
    expect(sidebarSource).not.toContain("translateKlyxUi");
    expect(sidebarSource).not.toContain("translateKlyxSidebarNavigation");
    expect(sidebarSource).not.toContain("klyx-sidebar-navigation-i18n");
    expect(sidebarSource).not.toContain("translateKlyxNavigationLabel");
    expect(sidebarSource).toContain("translateKlyxProviderAssistant");

    expect(composerSource).toContain("translateKlyxTolgeeRuntimeUi");
    expect(composerSource).toContain('"assistant.voice.label"');
    expect(composerSource).toContain('"assistant.voice.unavailable"');
    expect(composerSource).not.toContain(
      'unavailable: "Voice input is not supported by this browser."'
    );

    expect(runtimeSource).toContain("translateKlyxUi(locale, key)");
    expect(runtimeSource).toContain("translateKlyxNavigationLabel(locale, frenchLabel)");
    expect(runtimeSource).toContain('catalog[`navigation.${frenchLabel}`]');
    expect(runtimeSource).toContain('frCatalog[`ui.${key}`]');
    expect(runtimeSource).not.toContain("TOLGEE_API_KEY");
    expect(runtimeSource).not.toContain("NEXT_PUBLIC_TOLGEE");
    expect(runtimeSource).not.toContain("process.env");
    expect(runtimeSource).not.toContain("fetch(");
  });
});
