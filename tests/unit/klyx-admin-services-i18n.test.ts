import { describe, expect, it } from "vitest";
import {
  formatKlyxAdminServiceApproved,
  formatKlyxAdminServiceConfirm,
  getKlyxAdminServicesDictionary,
  KLYX_ADMIN_SERVICES_MESSAGE_KEYS,
  KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES,
  resolveKlyxAdminServicesLocale,
  translateKlyxAdminServiceProposalStatus,
} from "@/lib/klyx-admin-services-i18n";

describe("KLYX admin services i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminServicesDictionary(locale);
      for (const key of KLYX_ADMIN_SERVICES_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminServicesLocale("es")).toBe("fr");
    expect(getKlyxAdminServicesDictionary("es")).toEqual(
      getKlyxAdminServicesDictionary("fr")
    );
  });

  it("localizes known statuses and protects unknown values", () => {
    for (const locale of KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminServicesDictionary(locale);
      expect(translateKlyxAdminServiceProposalStatus(locale, "pending")).toBe(dictionary.pending);
      expect(translateKlyxAdminServiceProposalStatus(locale, "approved")).toBe(dictionary.approved);
      expect(translateKlyxAdminServiceProposalStatus(locale, "rejected")).toBe(dictionary.rejected);
      expect(translateKlyxAdminServiceProposalStatus(locale, "future")).toBe(dictionary.unknownStatus);
    }
  });

  it("keeps proposal names verbatim inside confirmation and success copy", () => {
    for (const locale of KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES) {
      expect(formatKlyxAdminServiceConfirm(locale, "approve", "Aide vélo")).toContain("Aide vélo");
      expect(formatKlyxAdminServiceConfirm(locale, "reject", "Aide vélo")).toContain("Aide vélo");
      expect(formatKlyxAdminServiceApproved(locale, "Aide vélo")).toContain("Aide vélo");
    }
  });
});
