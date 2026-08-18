import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

const criticalRoutePaths = [
  "app/api/admin/skill-verifications/document/route.ts",
  "app/api/admin/skill-verifications/route.ts",
  "app/api/admin/sumsub/route.ts",
  "app/api/admin/verifications/document/route.ts",
  "app/api/admin/verifications/route.ts",
  "app/api/brain/respond/route.ts",
  "app/api/bookings/create/route.ts",
  "app/api/bookings/status/route.ts",
  "app/api/bookings/tracking/route.ts",
  "app/api/bookings/overview/route.ts",
  "app/api/bookings/[id]/contact/route.ts",
  "app/api/booking-groups/[id]/route.ts",
  "app/api/booking-groups/[id]/cancellation/route.ts",
  "app/api/bookings/split-missions/route.ts",
  "app/api/bookings/split-missions/[id]/acceptance/route.ts",
  "app/api/bookings/split-missions/[id]/checkout/route.ts",
  "app/api/bookings/split-missions/[id]/refund-status/route.ts",
  "app/api/bookings/split-missions/[id]/payment-plan/route.ts",
  "app/api/bookings/split-missions/[id]/prices/route.ts",
  "app/api/bookings/split-missions/[id]/payment-confirmation/route.ts",
  "app/api/bookings/split-missions/[id]/stripe-readiness/route.ts",
  "app/api/disputes/route.ts",
  "app/api/provider/skill-requirements/route.ts",
  "app/api/provider/skills-verification/route.ts",
  "app/api/provider/sumsub/status/route.ts",
  "app/api/provider/sumsub/token/route.ts",
  "app/api/provider/verification/route.ts",
  "app/api/provider/verification/document/route.ts",
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
      "keeps admin authentication errors public while masking trust operation failures",
      () => {
        const adminAuth = read(
          "lib/admin-auth.ts"
        );
        const adminTrustRoutes = [
          "app/api/admin/skill-verifications/document/route.ts",
          "app/api/admin/skill-verifications/route.ts",
          "app/api/admin/sumsub/route.ts",
          "app/api/admin/verifications/document/route.ts",
          "app/api/admin/verifications/route.ts",
        ];

        expect(adminAuth)
          .toContain(
            "adminErrorPublicMessage"
          );
        expect(adminAuth)
          .toContain(
            'if (status === 401) return "Non connecté.";'
          );
        expect(adminAuth)
          .toContain(
            'if (status === 403) return "Accès administrateur refusé.";'
          );

        for (const relativePath of adminTrustRoutes) {
          const source = read(relativePath);

          expect(source)
            .toContain(
              "publicMessage: adminErrorPublicMessage(status)"
            );
        }

        const verificationRoute = read(
          "app/api/admin/verifications/route.ts"
        );

        expect(verificationRoute)
          .toContain(
            'event: "admin_verification_notification_failed"'
          );
        expect(verificationRoute)
          .toContain(
            "logServerError({"
          );
      }
    );

    it(
      "keeps provider skill validation messages public only as 4xx responses",
      () => {
        const source = read(
          "app/api/provider/skills-verification/route.ts"
        );

        expect(source)
          .toContain(
            "skillVerificationErrorStatus"
          );
        expect(source)
          .toContain(
            'message === "Métier prestataire introuvable."'
          );
        expect(source)
          .toContain(
            "SKILL_BAD_REQUEST_MESSAGES.has(message)"
          );
        expect(source)
          .toContain(
            "SKILL_CONFLICT_MESSAGES.has(message)"
          );
        expect(source)
          .toMatch(
            /publicMessage:\s*status\s*<\s*500/
          );
      }
    );

    it(
      "keeps provider group recovery before the secure fallback",
      () => {
        const source = read(
          "app/api/booking-groups/[id]/route.ts"
        );

        expect(source)
          .toContain(
            "klyxProviderGroupRecoveryResponse13_07("
          );
        expect(source)
          .toMatch(
            /if\s*\(\s*recovery\s*\)\s*\{\s*return\s+recovery;/
          );
        expect(source)
          .toContain(
            '"booking_group_recovery_failed"'
          );
      }
    );

    it(
      "keeps cancellation business conflicts public without exposing 5xx failures",
      () => {
        const source = read(
          "app/api/booking-groups/[id]/cancellation/route.ts"
        );

        expect(source)
          .toContain(
            '"KLYX_GROUP_CANCEL_SELF_APPROVAL"'
          );
        expect(source)
          .toContain(
            '"KLYX_GROUP_CANCEL_NOT_PENDING"'
          );
        expect(source)
          .toContain(
            '"KLYX_GROUP_CANCEL_PAYMENT_INTENT_MISSING"'
          );
        expect(source)
          .toMatch(
            /\?\s*409\s*:\s*apiErrorStatus/
          );
        expect(source)
          .toMatch(
            /publicMessage:\s*status\s*<\s*500/
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
