import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_STRIPE_CONFIRMATION_CANONICAL_CURRENCY_12B_6F

describe(
  "KLYX Stripe payment confirmation currency contract",
  () => {
    it(
      "uses only canonical bookings.currency when confirming payments",
      () => {
        const filePath =
          path.join(
            process.cwd(),
            "lib/stripe-payments.ts"
          );

        expect(
          fs.existsSync(filePath)
        ).toBe(true);

        const source =
          fs.readFileSync(
            filePath,
            "utf8"
          );

        expect(source).toContain(
          "currency: string | null;"
        );

        expect(source).toContain(
          "booking.currency"
        );

        expect(source).not.toContain(
          "currency_code"
        );
      }
    );
  }
);