import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_AI_FIRST_UI_CONTRACT_15_01

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/bookings/[id]/page.tsx"
  ),
  "utf8"
);

describe(
  "KLYX booking AI-first UI",
  () => {
    it(
      "keeps one mission journey and explicit manual payment safety",
      () => {
        expect(source).toContain(
          "KLYX_AI_FIRST_BOOKING_UI_15_01"
        );

        expect(source).toContain(
          "Suivi KLYX"
        );

        expect(source).toContain(
          "function JourneyStep("
        );

        expect(source).toContain(
          "Paiement manuel uniquement · aucun débit automatique."
        );

        expect(source).not.toContain(
          "Parcours de la mission"
        );

        expect(source).not.toContain(
          "function BookingPaymentStep("
        );
      }
    );
  }
);
