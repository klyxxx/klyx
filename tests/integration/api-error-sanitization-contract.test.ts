import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

const criticalRoutePaths = [
  "app/api/brain/respond/route.ts",
  "app/api/bookings/create/route.ts",
  "app/api/bookings/status/route.ts",
  "app/api/bookings/tracking/route.ts",
  "app/api/bookings/split-missions/[id]/checkout/route.ts",
  "app/api/disputes/route.ts",
  "app/api/stripe/create-checkout-session/route.ts",
  "app/api/stripe/create-group-checkout-session/route.ts",
  "app/api/stripe/connect/create-account/route.ts",
  "app/api/stripe/connect/status/route.ts",
  "app/api/stripe/webhook/route.ts",
  "app/api/sumsub/webhook/route.ts",
] as const;

function read(
  relativePath: string
): string {
  return fs.readFileSync(
    path.join(
      root,
      relativePath
    ),
    "utf8"
  );
}

describe(
  "KLYX critical API error sanitization contract",
  () => {
    it.each(
      criticalRoutePaths
    )(
      "%s uses the secure error boundary",
      (relativePath) => {
        const source = read(
          relativePath
        );

        expect(source)
          .toContain(
            'from "@/lib/api-error"'
          );
        expect(source)
          .toContain(
            "secureApiErrorResponse({"
          );
        expect(source)
          .not.toContain(
            "console.error"
          );
        expect(source)
          .not.toMatch(
            /error:\s*(?:message|rawMessage)\b/
          );
        expect(source)
          .not.toMatch(
            /detail:\s*error\s+instanceof\s+Error/
          );
      }
    );

    it(
      "keeps Stripe runtime assertions inside observed try blocks",
      () => {
        const stripeRoutes = [
          "app/api/stripe/create-checkout-session/route.ts",
          "app/api/stripe/create-group-checkout-session/route.ts",
          "app/api/stripe/connect/create-account/route.ts",
          "app/api/stripe/connect/status/route.ts",
          "app/api/bookings/split-missions/[id]/checkout/route.ts",
        ];

        for (
          const relativePath of stripeRoutes
        ) {
          const source = read(
            relativePath
          );

          expect(source)
            .toMatch(
              /try\s*\{[\s\S]*assertStripeRuntimeReady\(\)/
            );
        }
      }
    );

    it(
      "stores only stable failure codes for payment and KYC webhooks",
      () => {
        const stripeWebhook =
          read(
            "app/api/stripe/webhook/route.ts"
          );
        const stripeEvents =
          read(
            "lib/stripe-webhook-events.ts"
          );
        const sumsubWebhook =
          read(
            "app/api/sumsub/webhook/route.ts"
          );

        expect(stripeWebhook)
          .toContain(
            '"stripe_webhook_processing_failed"'
          );
        expect(stripeEvents)
          .toContain(
            "safeFailureCode"
          );
        expect(sumsubWebhook)
          .toContain(
            '"sumsub_webhook_processing_failed"'
          );
        expect(sumsubWebhook)
          .not.toContain(
            "message.slice(0, 1000)"
          );
      }
    );
  }
);
