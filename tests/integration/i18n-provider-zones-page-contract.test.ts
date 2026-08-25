import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const page = readRepoFile("app/provider/zones/page.tsx");
const route = readRepoFile("app/api/provider/zones/route.ts");
const core = readRepoFile("app/api/provider/zones/zones-route-core.ts");
const i18n = readRepoFile("lib/klyx-provider-zones-i18n.ts");

describe("KLYX provider zones i18n contract", () => {
  it("uses the shared locale provider with explicit French fallback", () => {
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderZones");
    expect(page).toContain("translateKlyxProviderZoneApiCode");
    expect(i18n).toContain(
      'return LOCALE_SET.has(locale) ? (locale as KlyxProviderZonesLocale) : "fr"'
    );
  });

  it("preserves the authenticated no-store zones read", () => {
    expect(page).toContain('fetch("/api/provider/zones"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${accessToken}`");
    expect(core).toContain('requireAccountType(profile, "provider")');
    expect(core).toContain('.eq("profile_id", profile.id)');
  });

  it("preserves the explicit POST payload and Belgian locality catalog", () => {
    expect(page).toContain('method: "POST"');
    expect(page).toContain("userServiceId,");
    expect(page).toContain("locality: selectedLocality.name");
    expect(page).toContain("selectedLocality.postalCodes[0] ?? \"\"");
    expect(page).toContain("radiusKm: Number(radiusKm)");
    expect(page).toContain("isPrimary,");
    expect(page).toContain("BELGIAN_LOCALITIES.find");
    expect(page).toContain("BELGIAN_LOCALITIES.map");
    expect(core).toContain("findBelgianLocality(localityInput)");
    expect(core).toContain("findBelgianLocality(postalInput)");
  });

  it("keeps country support fail-closed instead of pretending the Belgian catalog is global", () => {
    expect(core).toContain("profileCountryCode !==");
    expect(core).toContain("BELGIAN_LOCALITIES_COUNTRY_CODE");
    expect(core).toContain('code:\n            "KLYX_PROFILE_COUNTRY_REQUIRED"');
    expect(core).toContain('code:\n            "KLYX_LOCALITY_CATALOG_NOT_AVAILABLE"');
    expect(i18n).toContain("KLYX_PROFILE_COUNTRY_REQUIRED");
    expect(i18n).toContain("KLYX_LOCALITY_CATALOG_NOT_AVAILABLE");
  });

  it("preserves radius, ownership and primary-zone server boundaries", () => {
    expect(page).toContain('min="1"');
    expect(page).toContain('max="100"');
    expect(core).toContain("!Number.isInteger(radiusKm)");
    expect(core).toContain("radiusKm < 1");
    expect(core).toContain("radiusKm > 100");
    expect(core).toContain('.eq("user_id", profileId)');
    expect(core).toContain('.eq("provider_enabled", true)');
    expect(core).toContain('.eq("user_service_id", userServiceId)');
    expect(core).toContain("is_primary: false");
  });

  it("preserves explicit PATCH and DELETE actions with profile ownership", () => {
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain("zoneId: zone.id");
    expect(page).toContain("radiusKm: zone.radius_km");
    expect(page).toContain("isPrimary: true");
    expect(page).toContain("isActive: zone.is_active");
    expect(page).toContain('method: "DELETE"');
    expect(page).toContain("body: JSON.stringify({ zoneId })");
    expect(core).toContain('.eq("id", zoneId)');
    expect(core).toContain('.eq("profile_id", profile.id)');
  });

  it("keeps locality and service-authored data verbatim", () => {
    expect(page).toContain("service.custom_name ||");
    expect(page).toContain("relation?.name ||");
    expect(page).toContain("relation?.slug ||");
    expect(page).toContain("{zone.locality}");
    expect(page).toContain("zone.postal_code ?? t(\"belgium\")");
    expect(page).toContain("item.name");
    expect(page).toContain("item.postalCodes.join");
    expect(page).toContain("item.region");
  });

  it("does not reflect raw backend messages in localized presentation", () => {
    expect(page).toContain('setErrorMessage(t("loadError"))');
    expect(page).toContain('t("addError")');
    expect(page).toContain('setErrorMessage(t("updateError"))');
    expect(page).toContain('setErrorMessage(t("deleteError"))');
    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("body.message ||");
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("error.message");
  });

  it("does not collect browser GPS coordinates", () => {
    expect(page).not.toContain("navigator.geolocation");
    expect(page).not.toContain("getCurrentPosition");
    expect(page).not.toContain("watchPosition");
  });

  it("keeps unexpected server failures behind the secure route wrapper", () => {
    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('secureResponse("GET"');
    expect(route).toContain('secureResponse("POST"');
    expect(route).toContain('secureResponse("PATCH"');
    expect(route).toContain('secureResponse("DELETE"');
  });

  it("does not add booking, payment, refund or transfer execution", () => {
    for (const forbidden of [
      "create-checkout-session",
      "payment_intent",
      "refund",
      "transfer",
      'fetch("/api/bookings',
    ]) {
      expect(page.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
