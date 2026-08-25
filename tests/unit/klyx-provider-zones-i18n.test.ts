import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_ZONES_MESSAGE_KEYS,
  resolveKlyxProviderZonesLocale,
  translateKlyxProviderZoneApiCode,
  translateKlyxProviderZones,
} from "@/lib/klyx-provider-zones-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;

describe("KLYX provider zones i18n", () => {
  it("has a complete non-empty dictionary in every certified locale", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const key of KLYX_PROVIDER_ZONES_MESSAGE_KEYS) {
        expect(translateKlyxProviderZones(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("uses explicit French fallback outside provider-zones certification", () => {
    expect(resolveKlyxProviderZonesLocale("fr")).toBe("fr");
    expect(resolveKlyxProviderZonesLocale("en")).toBe("en");
    expect(resolveKlyxProviderZonesLocale("nl")).toBe("nl");
    expect(resolveKlyxProviderZonesLocale("de")).toBe("de");
    expect(resolveKlyxProviderZonesLocale("es")).toBe("fr");
    expect(translateKlyxProviderZones("es", "title")).toBe(
      translateKlyxProviderZones("fr", "title")
    );
  });

  it("localizes only the known country/catalog conflict codes", () => {
    for (const locale of CERTIFIED_LOCALES) {
      expect(
        translateKlyxProviderZoneApiCode(
          locale,
          "KLYX_PROFILE_COUNTRY_REQUIRED"
        )
      ).toBe(translateKlyxProviderZones(locale, "countryRequired"));

      expect(
        translateKlyxProviderZoneApiCode(
          locale,
          "KLYX_LOCALITY_CATALOG_NOT_AVAILABLE"
        )
      ).toBe(translateKlyxProviderZones(locale, "catalogUnavailable"));
    }
  });

  it("does not invent presentation for unknown future backend codes", () => {
    expect(
      translateKlyxProviderZoneApiCode("en", "KLYX_FUTURE_ZONE_CODE")
    ).toBeNull();
    expect(translateKlyxProviderZoneApiCode("fr", undefined)).toBeNull();
  });
});
