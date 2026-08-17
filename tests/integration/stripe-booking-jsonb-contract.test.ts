import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_STRIPE_JSONB_SPLIT_GUARD_12B_6D

describe(
  "KLYX Stripe JSONB booking guard",
  () => {
    it(
      "queries JSONB booking_ids using JSON syntax",
      () => {
        const filePath =
          path.join(
            process.cwd(),
            "app/api/stripe/create-checkout-session/route.ts"
          );

        const source =
          fs.readFileSync(
            filePath,
            "utf8"
          );

        expect(source).toContain(
          '.filter('
        );

        expect(source).toContain(
          '"booking_ids"'
        );

        expect(source).toContain(
          '"cs"'
        );

        expect(source).toContain(
          "JSON.stringify([booking.id])"
        );

        expect(source).not.toContain(
          '.contains(\n        "booking_ids",\n        [booking.id]'
        );
      }
    );
  }
);