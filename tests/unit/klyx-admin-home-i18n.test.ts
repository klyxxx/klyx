import { describe, expect, it } from "vitest";
import {
  getKlyxAdminHomeAreaCopy,
  getKlyxAdminHomeDictionary,
  KLYX_ADMIN_HOME_AREA_IDS,
  KLYX_ADMIN_HOME_MESSAGE_KEYS,
  KLYX_ADMIN_HOME_TRANSLATED_LOCALES,
  resolveKlyxAdminHomeLocale,
} from "@/lib/klyx-admin-home-i18n";

describe("KLYX admin home i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_HOME_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminHomeDictionary(locale);

      for (const key of KLYX_ADMIN_HOME_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }

      for (const areaId of KLYX_ADMIN_HOME_AREA_IDS) {
        const copy = getKlyxAdminHomeAreaCopy(locale, areaId);
        expect(copy.title.trim().length).toBeGreaterThan(0);
        expect(copy.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminHomeLocale("es")).toBe("fr");
    expect(getKlyxAdminHomeDictionary("es")).toEqual(
      getKlyxAdminHomeDictionary("fr")
    );
    expect(getKlyxAdminHomeAreaCopy("es", "launchCenter")).toEqual(
      getKlyxAdminHomeAreaCopy("fr", "launchCenter")
    );
  });
});
