import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_AI_FIRST_UI_CONTRACT_15_01

const source = fs.readFileSync(
  path.join(process.cwd(), "app/bookings/[id]/page.tsx"),
  "utf8"
);

const dictionary = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-booking-detail-i18n.ts"),
  "utf8"
);

describe("KLYX booking AI-first UI", () => {
  it("keeps one mission journey and explicit manual payment safety", () => {
    expect(source).toContain("KLYX_AI_FIRST_BOOKING_UI_15_01");
    expect(source).toContain('t("tracking")');
    expect(source).toContain("function JourneyStep(");
    expect(source).toContain('t("manualPaymentSafety")');

    expect(dictionary).toContain('tracking: "Suivi KLYX"');
    expect(dictionary).toContain(
      "Paiement manuel uniquement · aucun débit automatique."
    );
    expect(dictionary).toContain(
      "Manual payment only · no automatic charge."
    );
    expect(dictionary).toContain(
      "Alleen handmatige betaling · geen automatische afschrijving."
    );
    expect(dictionary).toContain(
      "Nur manuelle Zahlung · keine automatische Belastung."
    );

    expect(source).not.toContain("Parcours de la mission");
    expect(source).not.toContain("function BookingPaymentStep(");
  });
});
