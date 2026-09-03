import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  KLYX_LANGUAGE_OPTIONS,
  type KlyxLocale,
} from "../../lib/klyx-i18n";
import { KLYX_PROVIDER_ASSISTANT_CORE_ROWS } from "../../lib/klyx-provider-assistant-core-locales";
import {
  getKlyxProviderAssistantExamples,
  getKlyxProviderAssistantIntlLocale,
  resolveKlyxProviderAssistantLocale,
  translateKlyxProviderAssistant,
} from "../../lib/klyx-provider-assistant-i18n";

const page = fs.readFileSync(
  path.join(process.cwd(), "app/provider/assistant/page.tsx"),
  "utf8"
);

const advertisedLocales = KLYX_LANGUAGE_OPTIONS.map((option) => option.value);

describe("provider assistant all-locale contract", () => {
  it("has core assistant copy for every locale exposed by the language picker", () => {
    expect(Object.keys(KLYX_PROVIDER_ASSISTANT_CORE_ROWS).sort()).toEqual(
      [...advertisedLocales].sort()
    );
    expect(advertisedLocales).toHaveLength(64);
  });

  it("never resolves an advertised locale back to French", () => {
    for (const locale of advertisedLocales) {
      expect(resolveKlyxProviderAssistantLocale(locale)).toBe(locale);
      expect(getKlyxProviderAssistantIntlLocale(locale)).toBe(
        KLYX_LANGUAGE_OPTIONS.find((option) => option.value === locale)?.htmlLang
      );
    }
  });

  it("keeps visible core copy native for every non-French locale", () => {
    const frenchQuestion = translateKlyxProviderAssistant("fr", "prepareQuestion");
    const frenchDescription = translateKlyxProviderAssistant("fr", "surfaceDescription");
    const frenchIntro = translateKlyxProviderAssistant("fr", "conversationIntro");
    const frenchPlaceholder = translateKlyxProviderAssistant("fr", "placeholder");
    const frenchDrafts = translateKlyxProviderAssistant("fr", "draftsTitle");
    const frenchNoDrafts = translateKlyxProviderAssistant("fr", "noDrafts");
    const frenchControl = translateKlyxProviderAssistant("fr", "controlNote");

    for (const locale of advertisedLocales.filter((value) => value !== "fr")) {
      const typedLocale = locale as KlyxLocale;
      expect(translateKlyxProviderAssistant(typedLocale, "prepareQuestion")).not.toBe(frenchQuestion);
      expect(translateKlyxProviderAssistant(typedLocale, "surfaceDescription")).not.toBe(frenchDescription);
      expect(translateKlyxProviderAssistant(typedLocale, "conversationIntro")).not.toBe(frenchIntro);
      expect(translateKlyxProviderAssistant(typedLocale, "placeholder")).not.toBe(frenchPlaceholder);
      expect(translateKlyxProviderAssistant(typedLocale, "draftsTitle")).not.toBe(frenchDrafts);
      expect(translateKlyxProviderAssistant(typedLocale, "noDrafts")).not.toBe(frenchNoDrafts);
      expect(translateKlyxProviderAssistant(typedLocale, "controlNote")).not.toBe(frenchControl);
      expect(getKlyxProviderAssistantExamples(typedLocale)).toHaveLength(2);
      expect(getKlyxProviderAssistantExamples(typedLocale)).not.toContain(
        "Je suis libre jeudi de 9 h à 14 h."
      );
    }
  });

  it("routes the conversational surface through the locale dictionary", () => {
    expect(page).toContain('t("badge")');
    expect(page).toContain('t("prepareQuestion")');
    expect(page).toContain('t("surfaceDescription")');
    expect(page).toContain('aria-label={t("conversationLabel")}');
    expect(page).toContain('t("conversationIntro")');
    expect(page).toContain('t("preparing")');
    expect(page).toContain('t("draftsTitle")');
    expect(page).toContain('t("draftReady")');
    expect(page).toContain('placeholder={t("placeholder")}');
    expect(page).toContain('t("controlNote")');

    expect(page).not.toContain("Que dois-je préparer pour ton activité ?");
    expect(page).not.toContain("Conversation avec KLYX");
    expect(page).not.toContain("Brouillons à vérifier");
    expect(page).not.toContain("Demander à KLYX…");
  });
});
