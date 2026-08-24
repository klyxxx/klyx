import { describe, expect, it } from "vitest";
import {
  formatKlyxAdminSkillExperience,
  getKlyxAdminSkillsDictionary,
  KLYX_ADMIN_SKILLS_MESSAGE_KEYS,
  KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES,
  resolveKlyxAdminSkillsLocale,
  translateKlyxAdminSkillDocumentStatus,
  translateKlyxAdminSkillStatus,
} from "@/lib/klyx-admin-skills-i18n";

describe("KLYX admin skills i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminSkillsDictionary(locale);

      for (const key of KLYX_ADMIN_SKILLS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminSkillsLocale("es")).toBe("fr");
    expect(getKlyxAdminSkillsDictionary("es")).toEqual(
      getKlyxAdminSkillsDictionary("fr")
    );
  });

  it("localizes known verification statuses and protects unknown values", () => {
    for (const locale of KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminSkillsDictionary(locale);

      expect(translateKlyxAdminSkillStatus(locale, "approved").trim()).not.toBe("");
      expect(translateKlyxAdminSkillStatus(locale, "future_status")).toBe(
        dictionary.unknownStatus
      );
      expect(
        translateKlyxAdminSkillDocumentStatus(locale, "approved").trim()
      ).not.toBe("");
      expect(
        translateKlyxAdminSkillDocumentStatus(locale, "future_document_status")
      ).toBe(dictionary.unknownDocumentStatus);
    }
  });

  it("formats experience without changing the numeric value", () => {
    for (const locale of KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES) {
      expect(formatKlyxAdminSkillExperience(locale, 2)).toContain("2");
    }

    expect(formatKlyxAdminSkillExperience("es", 1)).toBe(
      formatKlyxAdminSkillExperience("fr", 1)
    );
  });
});
