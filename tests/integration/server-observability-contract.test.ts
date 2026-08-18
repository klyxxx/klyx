import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root =
  process.cwd();

const brain =
  fs.readFileSync(
    path.join(
      root,
      "app/api/brain/respond/route.ts"
    ),
    "utf8"
  );

const stripe =
  fs.readFileSync(
    path.join(
      root,
      "app/api/stripe/create-checkout-session/route.ts"
    ),
    "utf8"
  );

const logger =
  fs.readFileSync(
    path.join(
      root,
      "lib/server-log.ts"
    ),
    "utf8"
  );

describe(
  "KLYX production observability contract",
  () => {
    it(
      "wires safe logging into Brain",
      () => {
        expect(brain)
          .toContain(
            "KLYX_SERVER_OBSERVABILITY_12B_8B"
          );

        expect(brain)
          .toContain(
            'from "@/lib/server-log"'
          );

        expect(brain)
          .toContain(
            '"brain_request_completed"'
          );

        expect(brain)
          .toContain(
            '"brain_request_failed"'
          );

        expect(brain)
          .not.toContain(
            'console.error("KLYX Brain error:", error)'
          );
      }
    );

    it(
      "wires safe logging into Stripe checkout",
      () => {
        expect(stripe)
          .toContain(
            "KLYX_SERVER_OBSERVABILITY_12B_8B"
          );

        expect(stripe)
          .toContain(
            'from "@/lib/server-log"'
          );

        expect(stripe)
          .toContain(
            '"stripe_checkout_created"'
          );

        expect(stripe)
          .toContain(
            '"stripe_checkout_reused"'
          );

        expect(stripe)
          .toContain(
            '"stripe_checkout_failed"'
          );

        expect(stripe)
          .not.toContain(
            '"Stripe universal checkout error:"'
          );
      }
    );

    it(
      "keeps the logger privacy boundary",
      () => {
        expect(logger)
          .toContain(
            "KLYX_SERVER_LOG_V1"
          );

        expect(logger)
          .toContain(
            "errorName"
          );

        expect(logger)
          .not.toContain(
            "error.message"
          );

        expect(logger)
          .not.toContain(
            "error.stack"
          );
      }
    );
  }
);
