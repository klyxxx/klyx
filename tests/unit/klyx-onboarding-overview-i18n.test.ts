import { describe, expect, it } from "vitest";

import {
  KLYX_ONBOARDING_OVERVIEW_TRANSLATED_LOCALES,
  formatKlyxOnboardingWelcome,
  getKlyxOnboardingOverviewDictionary,
  hasKlyxOnboardingOverviewTranslation,
  resolveKlyxOnboardingOverviewLocale,
  translateKlyxOnboardingOverview,
  type KlyxOnboardingOverviewMessageKey,
} from "../../lib/klyx-onboarding-overview-i18n";

const REQUIRED_KEYS: KlyxOnboardingOverviewMessageKey[] = [
  "firstSetup",
  "welcome",
  "welcomeKlyx",
  "providerIntro",
  "clientIntro",
  "dashboard",
  "providerPath",
  "clientPath",
  "nextAction",
  "providerNextTitle",
  "clientNextTitle",
  "prepareActivity",
  "opportunities",
  "organizeNeed",
  "searchMyself",
  "start",
  "providerStart",
  "clientStart",
  "providerOpportunitiesTitle",
  "openOpportunities",
  "providerAssistantTitle",
  "openAssistant",
  "clientProfileTitle",
  "clientProfileDescription",
  "clientProfileButton",
  "clientNeedTitle",
  "clientNeedDescription",
  "clientNeedButton",
  "clientCompareTitle",
  "clientCompareDescription",
  "clientCompareButton",
];

describe("KLYX onboarding overview i18n", () => {
  it("keeps every certified overview dictionary complete", () => {
    for (const locale of KLYX_ONBOARDING_OVERVIEW_TRANSLATED_LOCALES) {
      const dictionary = getKlyxOnboardingOverviewDictionary(locale);
      for (const key of REQUIRED_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real translated onboarding overview copy", () => {
    expect(translateKlyxOnboardingOverview("en", "nextAction")).toBe("Next action");
    expect(translateKlyxOnboardingOverview("nl", "clientNeedButton")).toBe("Met KLYX praten");
    expect(translateKlyxOnboardingOverview("de", "prepareActivity")).toBe(
      "Meine Tätigkeit vorbereiten"
    );
    expect(formatKlyxOnboardingWelcome("en", "Alex")).toBe("Welcome Alex");
  });

  it("keeps partial page coverage explicit with French fallback", () => {
    expect(hasKlyxOnboardingOverviewTranslation("de")).toBe(true);
    expect(hasKlyxOnboardingOverviewTranslation("es")).toBe(false);
    expect(resolveKlyxOnboardingOverviewLocale("es")).toBe("fr");
    expect(translateKlyxOnboardingOverview("es", "dashboard")).toBe(
      "Voir mon tableau de bord"
    );
  });
});
