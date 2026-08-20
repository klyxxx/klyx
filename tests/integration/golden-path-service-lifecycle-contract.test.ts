import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs
    .readFileSync(repoPath(file), "utf8")
    .replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(".github/workflows/klyx-golden-path.yml");
const lifecycle = readRepoFile("scripts/golden-path-service-lifecycle.mjs");

describe("KLYX signed webhook mission-review golden path", () => {
  it("keeps the lifecycle script syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-service-lifecycle.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("runs only after the real quote-to-booking lifecycle on the local production server", () => {
    const bookingLifecycle = "node scripts/golden-path-client-lifecycle.mjs";
    const serviceLifecycle = "node scripts/golden-path-service-lifecycle.mjs";

    expect(workflow).toContain("npm run start -- -p 3100");
    expect(workflow).toContain(bookingLifecycle);
    expect(workflow).toContain(serviceLifecycle);
    expect(workflow.indexOf(bookingLifecycle)).toBeLessThan(
      workflow.indexOf(serviceLifecycle)
    );
    expect(workflow.indexOf(serviceLifecycle)).toBeLessThan(
      workflow.indexOf("Stop golden path production server")
    );
  });

  it("proves KLYX webhook signature handling without pretending to call Stripe Checkout", () => {
    expect(lifecycle).toContain('createHmac("sha256"');
    expect(lifecycle).toContain('path: "/api/stripe/webhook"');
    expect(lifecycle).toContain('"stripe-signature": signature');
    expect(lifecycle).toContain('type: "checkout.session.completed"');
    expect(lifecycle).toContain('payment_status: "paid"');
    expect(lifecycle).toContain("duplicateWebhook.payload?.duplicate !== true");
    expect(lifecycle).not.toContain("create-checkout-session");
    expect(lifecycle).not.toContain("stripe.checkout.sessions.create");
    expect(lifecycle).not.toContain("sk_live_");
  });

  it("verifies payment persistence, ledger and webhook idempotency", () => {
    expect(lifecycle).toContain('.from("booking_financial_ledger")');
    expect(lifecycle).toContain('.from("stripe_webhook_events")');
    expect(lifecycle).toContain('ledger.status !== "succeeded"');
    expect(lifecycle).toContain('paidBooking.payment_status !== "paid"');
    expect(lifecycle).toContain('webhookRecord.status !== "processed"');
    expect(lifecycle).toContain('Number(webhookRecord.attempt_count) !== 1');
    expect(lifecycle).toContain('payment-success:client');
    expect(lifecycle).toContain('payment-success:provider');
  });

  it("executes provider tracking, client completion and review through real APIs", () => {
    expect(lifecycle).toContain('path: "/api/bookings/tracking"');
    expect(lifecycle).toContain('action: "provider_finished"');
    expect(lifecycle).toContain('action: "client_confirmed"');
    expect(lifecycle).toContain('path: "/api/reviews"');
    expect(lifecycle).toContain("rating: 5");
    expect(lifecycle).toContain('completedBooking.status !== "completed"');
    expect(lifecycle).toContain('completedBooking.service_status !== "completed"');
    expect(lifecycle).toContain('.from("booking_tracking_events")');
  });

  it("remains isolated from production and real Stripe credentials", () => {
    expect(lifecycle).toContain("assertGoldenPathIsolation");
    expect(lifecycle).toContain("if (!localSupabase)");
    expect(lifecycle).toContain(
      'appOrigin !== "http://127.0.0.1:3100"'
    );
    expect(workflow).toContain(
      'STRIPE_SECRET_KEY: "sk_test_klyx_golden_path_local_only"'
    );
    expect(workflow).toContain(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_klyx_golden_path_local_only"'
    );
  });
});
