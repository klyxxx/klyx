import { describe, expect, it } from "vitest";
import {
  getKlyxFounderHomeDictionary,
  KLYX_FOUNDER_HOME_MESSAGE_KEYS,
  KLYX_FOUNDER_HOME_TRANSLATED_LOCALES,
  resolveKlyxFounderHomeLocale,
} from "@/lib/klyx-founder-home-i18n";

describe("KLYX founder home i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_HOME_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderHomeDictionary(locale);
      for (const key of KLYX_FOUNDER_HOME_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFounderHomeLocale("es")).toBe("fr");
    expect(getKlyxFounderHomeDictionary("es")).toEqual(
      getKlyxFounderHomeDictionary("fr")
    );
  });
});
