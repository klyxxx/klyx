import { describe, expect, it } from "vitest";

import {
  KLYX_FULLY_TRANSLATED_LOCALES,
  KLYX_REGISTERED_LANGUAGE_OPTIONS,
} from "../../lib/klyx-i18n";
import {
  KLYX_CRITICAL_LOCALE_SURFACES,
  KLYX_END_TO_END_READY_LOCALES,
  KLYX_REQUIRED_LOCALE_READINESS_GROUPS,
  getKlyxLocaleReadiness,
} from "../../lib/klyx-locale-readiness";

describe("KLYX locale readiness manifest", () => {
  it("keeps the selectable locale contract equal to computed end-to-end readiness", () => {
    expect(KLYX_END_TO_END_READY_LOCALES).toEqual(
      KLYX_FULLY_TRANSLATED_LOCALES
    );
    expect(KLYX_END_TO_END_READY_LOCALES).toEqual([
      "fr",
      "en",
      "nl",
      "de",
    ]);
  });

  it("covers every required product-readiness group", () => {
    const groups = new Set(
      KLYX_CRITICAL_LOCALE_SURFACES.map((surface) => surface.group)
    );

    for (const group of KLYX_REQUIRED_LOCALE_READINESS_GROUPS) {
      expect(groups.has(group), `Missing locale readiness group: ${group}`).toBe(true);
    }
  });

  it("keeps critical surface identifiers unique and backed by registered locales", () => {
    const ids = KLYX_CRITICAL_LOCALE_SURFACES.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);

    const registered = new Set(
      KLYX_REGISTERED_LANGUAGE_OPTIONS.map((option) => option.value)
    );

    for (const surface of KLYX_CRITICAL_LOCALE_SURFACES) {
      expect(surface.locales.length, `${surface.id} has no translated locales`).toBeGreaterThan(0);
      for (const locale of surface.locales) {
        expect(
          registered.has(locale as (typeof KLYX_REGISTERED_LANGUAGE_OPTIONS)[number]["value"]),
          `${surface.id} declares unknown locale: ${locale}`
        ).toBe(true);
      }
    }
  });

  it("does not promote Spanish while critical product surfaces still fall back", () => {
    const readiness = getKlyxLocaleReadiness("es");

    expect(readiness.ready).toBe(false);
    expect(readiness.missingSurfaces.length).toBeGreaterThan(0);
    expect(readiness.missingSurfaces.map((surface) => surface.group)).toEqual(
      expect.arrayContaining([
        "public-auth",
        "client-core",
        "provider-core",
        "transactional-legal",
      ])
    );
  });
});
