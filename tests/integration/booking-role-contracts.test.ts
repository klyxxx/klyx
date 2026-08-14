import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_BOOKING_ROLE_CONTRACTS_13_30

const root =
  process.cwd();

function read(
  relativePath:
    string
): string {
  const file =
    path.join(
      root,
      relativePath
    );

  expect(
    fs.existsSync(
      file
    ),
    "Required KLYX file missing: " +
      relativePath
  ).toBe(
    true
  );

  return fs.readFileSync(
    file,
    "utf8"
  );
}

describe(
  "KLYX critical booking and role contracts",
  () => {
    it(
      "booking creation route still exists",
      () => {
        expect(
          fs.existsSync(
            path.join(
              root,
              "app/api/bookings/create/route.ts"
            )
          )
        ).toBe(
          true
        );
      }
    );

    it(
      "split Checkout requires client role",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          'requireAccountType'
        );

        expect(
          source
        ).toContain(
          '"client"'
        );
      }
    );

    it(
      "split payment cannot bypass final payment proof",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "split_booking_payment_confirmations"
        );

        expect(
          source
        ).toContain(
          "payment_plan_hash"
        );

        expect(
          source
        ).toContain(
          "SPLIT_PAYMENT_CONFIRMATION_REQUIRED"
        );
      }
    );

    it(
      "split Checkout revalidates live booking prices",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "estimated_amount_cents"
        );

        expect(
          source
        ).toContain(
          "amount_total"
        );

        expect(
          source
        ).toContain(
          "SPLIT_LIVE_BOOKING_CHANGED"
        );
      }
    );

    it(
      "split Checkout revalidates provider acceptance",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "bookingAccepted"
        );
      }
    );

    it(
      "split Checkout blocks children already carrying payment state",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "paymentAlreadyClaimed"
        );

        expect(
          source
        ).toContain(
          "SPLIT_CHILD_ALREADY_HAS_PAYMENT"
        );
      }
    );

    it(
      "legacy Checkout still detects already-paid bookings",
      () => {
        const source =
          read(
            "app/api/stripe/create-checkout-session/route.ts"
          );

        expect(
          source
        ).toContain(
          'payment_status === "paid"'
        );

        expect(
          source
        ).toContain(
          "alreadyPaid"
        );
      }
    );

    it(
      "legacy Checkout still uses an atomic payment claim",
      () => {
        const source =
          read(
            "app/api/stripe/create-checkout-session/route.ts"
          );

        expect(
          source
        ).toContain(
          "klyx_claim_booking_payment"
        );

        expect(
          source
        ).toContain(
          "idempotencyKey"
        );
      }
    );

    it(
      "Stripe webhook remains idempotently claimed",
      () => {
        const source =
          read(
            "app/api/stripe/webhook/route.ts"
          );

        expect(
          source
        ).toContain(
          "claimStripeWebhookEvent"
        );

        expect(
          source
        ).toContain(
          "markStripeWebhookProcessed"
        );
      }
    );

    it(
      "split refunds cannot enter the legacy refund engine",
      () => {
        const source =
          read(
            "lib/stripe-refunds.ts"
          );

        expect(
          source
        ).toContain(
          "KLYX_SPLIT_REFUND_LEGACY_GUARD_13_28"
        );

        expect(
          source
        ).toContain(
          "split_booking_payment_units"
        );
      }
    );
  }
);