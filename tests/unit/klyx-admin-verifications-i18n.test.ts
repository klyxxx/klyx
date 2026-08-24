import { describe, expect, it } from "vitest";
import {
  getKlyxAdminVerificationPrecheckText,
  getKlyxAdminVerificationsDictionary,
  KLYX_ADMIN_VERIFICATIONS_MESSAGE_KEYS,
  KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES,
  resolveKlyxAdminVerificationsLocale,
  translateKlyxAdminVerificationAction,
  translateKlyxAdminVerificationStatus,
} from "@/lib/klyx-admin-verifications-i18n";

describe("KLYX admin verifications i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminVerificationsDictionary(locale);
      for (const key of KLYX_ADMIN_VERIFICATIONS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminVerificationsLocale("es")).toBe("fr");
    expect(getKlyxAdminVerificationsDictionary("es")).toEqual(
      getKlyxAdminVerificationsDictionary("fr")
    );
  });

  it("localizes review actions and protects unknown statuses", () => {
    for (const locale of KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminVerificationsDictionary(locale);
      expect(translateKlyxAdminVerificationAction(locale, "approved")).toBe(dictionary.approveAction);
      expect(translateKlyxAdminVerificationAction(locale, "rejected")).toBe(dictionary.rejectAction);
      expect(translateKlyxAdminVerificationStatus(locale, "future")).toBe(dictionary.unknownStatus);
    }
  });

  it("localizes stable precheck codes without changing their pass state or count", () => {
    for (const locale of KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES) {
      const found = getKlyxAdminVerificationPrecheckText(locale, {
        code: "identity_present",
        passed: true,
        detail: "2 document(s) trouvé(s).",
      });
      expect(found.detail).toContain("2");

      const failed = getKlyxAdminVerificationPrecheckText(locale, {
        code: "sizes_allowed",
        passed: false,
        detail: "Au moins un fichier dépasse la limite.",
      });
      expect(failed.label.trim().length).toBeGreaterThan(0);
      expect(failed.detail.trim().length).toBeGreaterThan(0);

      const unknown = getKlyxAdminVerificationPrecheckText(locale, {
        code: "future_check",
        passed: false,
        detail: "backend copy",
      });
      expect(unknown.label).toBe(getKlyxAdminVerificationsDictionary(locale).unknownPrecheck);
      expect(unknown.detail).not.toBe("backend copy");
    }
  });
});
