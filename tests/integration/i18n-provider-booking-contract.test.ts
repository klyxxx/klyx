import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider booking i18n contract", () => {
  it("keeps the active booking contract intact while localizing the page", () => {
    const page = read("app/providers/[id]/book/page.tsx");

    expect(page).toContain("KLYX_PROVIDER_BOOKING_I18N_16_07");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderBooking");
    expect(page).toContain('fetch("/api/bookings/create"');
    expect(page).toContain("providerId,");
    expect(page).toContain("serviceSlug,");
    expect(page).toContain("bookingDate,");
    expect(page).toContain("startTime,");
    expect(page).toContain("endTime,");
    expect(page).toContain("message,");
    expect(page).toContain("selectedDayAvailability.some");
  });

  it("does not reflect raw Supabase or booking API errors", () => {
    const page = read("app/providers/[id]/book/page.tsx");

    expect(page).not.toContain("profileError.message");
    expect(page).not.toContain("serviceResult.error.message");
    expect(page).not.toContain("userServiceError.message");
    expect(page).not.toContain("serviceProfileResult.error.message");
    expect(page).not.toContain("availabilityResult.error.message");
    expect(page).not.toContain("result.error");
  });

  it("moves representative French booking copy out of the page component", () => {
    const page = read("app/providers/[id]/book/page.tsx");

    expect(page).not.toContain("Chargement...");
    expect(page).not.toContain("Retour au profil");
    expect(page).not.toContain("Choisis ton créneau");
    expect(page).not.toContain("Détails de la demande");
    expect(page).not.toContain("Récapitulatif");
    expect(page).not.toContain("Envoyer la demande");
    expect(page).not.toContain("Aucun paiement n’est débité");
  });

  it("ships complete typed dictionaries for the initial launch locales", () => {
    const dictionary = read("lib/klyx-provider-booking-i18n.ts");

    expect(dictionary).toContain('"fr"');
    expect(dictionary).toContain('"en"');
    expect(dictionary).toContain('"nl"');
    expect(dictionary).toContain('"de"');
    expect(dictionary).toContain(
      "Record<KlyxProviderBookingLocale, Dictionary>"
    );
    expect(dictionary).toContain("replaceAll");
  });
});
