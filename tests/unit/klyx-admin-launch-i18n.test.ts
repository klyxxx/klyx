import { describe, expect, it } from "vitest";
import {
  formatKlyxAdminLaunchProbeDetail,
  getKlyxAdminLaunchDictionary,
  getKlyxAdminLaunchProbeCopy,
  KLYX_ADMIN_LAUNCH_MESSAGE_KEYS,
  KLYX_ADMIN_LAUNCH_PROBE_IDS,
  KLYX_ADMIN_LAUNCH_TRANSLATED_LOCALES,
  resolveKlyxAdminLaunchLocale,
} from "@/lib/klyx-admin-launch-i18n";

describe("KLYX admin launch i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_LAUNCH_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminLaunchDictionary(locale);

      for (const key of KLYX_ADMIN_LAUNCH_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }

      for (const probeId of KLYX_ADMIN_LAUNCH_PROBE_IDS) {
        const copy = getKlyxAdminLaunchProbeCopy(locale, probeId);
        expect(copy.title.trim().length).toBeGreaterThan(0);
        expect(copy.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminLaunchLocale("es")).toBe("fr");
    expect(getKlyxAdminLaunchDictionary("es")).toEqual(
      getKlyxAdminLaunchDictionary("fr")
    );
    expect(getKlyxAdminLaunchProbeCopy("es", "home")).toEqual(
      getKlyxAdminLaunchProbeCopy("fr", "home")
    );
  });

  it("keeps HTTP details intact and sanitizes probe exceptions", () => {
    for (const locale of KLYX_ADMIN_LAUNCH_TRANSLATED_LOCALES) {
      expect(formatKlyxAdminLaunchProbeDetail(locale, 204)).toBe("HTTP 204");
      expect(formatKlyxAdminLaunchProbeDetail(locale, null)).toBe(
        getKlyxAdminLaunchDictionary(locale).probeFailed
      );
    }
  });
});
