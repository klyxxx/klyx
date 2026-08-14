import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_PAYMENT_SAFETY_CONTRACT_TESTS_13_29

const root =
  process.cwd();

function read(
  relativePath:
    string
): string {
  const filePath =
    path.join(
      root,
      relativePath
    );

  expect(
    fs.existsSync(
      filePath
    ),
    "Required KLYX file missing: " +
      relativePath
  ).toBe(
    true
  );

  return fs.readFileSync(
    filePath,
    "utf8"
  );
}

describe(
  "KLYX payment safety contracts",
  () => {
    it(
      "keeps explicit payment confirmation before split Checkout",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "checkoutPreparationConfirmed"
        );

        expect(
          source
        ).toContain(
          "split_booking_payment_confirmations"
        );

        expect(
          source
        ).toContain(
          "SPLIT_PAYMENT_CONFIRMATION_REQUIRED"
        );
      }
    );

    it(
      "keeps Stripe idempotency for split payment units",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "idempotencyKey"
        );

        expect(
          source
        ).toContain(
          "klyx_claim_split_payment_unit_13_27"
        );

        expect(
          source
        ).toContain(
          "klyx_attach_split_checkout_13_27"
        );
      }
    );

    it(
      "keeps live Stripe Connect readiness checks",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "stripe.accounts.retrieve"
        );

        expect(
          source
        ).toContain(
          "charges_enabled"
        );

        expect(
          source
        ).toContain(
          "payouts_enabled"
        );

        expect(
          source
        ).toContain(
          "details_submitted"
        );
      }
    );

    it(
      "keeps destination charge architecture and KLYX fee",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "transfer_data"
        );

        expect(
          source
        ).toContain(
          "application_fee_amount"
        );
      }
    );

    it(
      "keeps legacy single-booking checkout blocked for split children",
      () => {
        const source =
          read(
            "app/api/stripe/create-checkout-session/route.ts"
          );

        expect(
          source
        ).toContain(
          "KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27"
        );

        expect(
          source
        ).toContain(
          "split_booking_payment_units"
        );
      }
    );

    it(
      "keeps split Stripe webhook routing active",
      () => {
        const source =
          read(
            "app/api/stripe/webhook/route.ts"
          );

        expect(
          source
        ).toContain(
          "handleSplitStripeWebhookEvent"
        );

        expect(
          source
        ).toContain(
          "KLYX_SPLIT_STRIPE_WEBHOOK_WIRING_13_27"
        );
      }
    );

    it(
      "keeps split refund events isolated from the legacy refund engine",
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
      }
    );

    it(
      "keeps split payment automatic execution disabled",
      () => {
        const source =
          read(
            "app/api/bookings/split-missions/[id]/checkout/route.ts"
          );

        expect(
          source
        ).toContain(
          "automaticPayment"
        );

        expect(
          source
        ).toContain(
          "moneyMovedAutomatically"
        );
      }
    );
  }
);