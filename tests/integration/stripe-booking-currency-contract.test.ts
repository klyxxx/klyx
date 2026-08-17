import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_STRIPE_CANONICAL_BOOKING_CURRENCY_12B_6_FIX

describe(
  "KLYX Stripe booking currency contract",
  () => {
    it(
      "uses canonical bookings.currency for standard checkout",
      () => {
        const filePath =
          path.join(
            process.cwd(),
            "app/api/stripe/create-checkout-session/route.ts"
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
          "payment_status, currency, pricing_type_snapshot"
        );

        expect(source).toContain(
          "booking.currency"
        );

        expect(source).not.toContain(
          "booking.currency_code"
        );

        expect(source).not.toContain(
          "payment_status, currency_code, pricing_type_snapshot"
        );
      }
    );
  }
);