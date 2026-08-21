import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(
  ".github/workflows/klyx-stripe-network-test.yml"
);
const proof = readRepoFile(
  "scripts/golden-path-stripe-network-checkout.mjs"
);

describe("KLYX Stripe network Checkout proof", () => {
  it("keeps the network proof script syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-stripe-network-checkout.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("is manual-only and requires an explicit Stripe test confirmation", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain("confirm_stripe_test_network");
    expect(workflow).toContain(
      'if [ "$KLYX_GOLDEN_PATH_MUTATIONS_ENABLED" != "true" ]'
    );
  });

  it("requires dedicated test-mode Stripe secrets and rejects live mode", () => {
    expect(workflow).toContain(
      "STRIPE_SECRET_KEY: ${{ secrets.KLYX_STRIPE_TEST_SECRET_KEY }}"
    );
    expect(workflow).toContain(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.KLYX_STRIPE_TEST_PUBLISHABLE_KEY }}"
    );
    expect(workflow).toContain("sk_test_*");
    expect(workflow).toContain("pk_test_*");
    expect(workflow).toContain('KLYX_STRIPE_MODE: "test"');
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).toContain(
      'KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS: "true"'
    );
    expect(workflow).not.toContain("sk_live_");
    expect(workflow).not.toContain("pk_live_");
    expect(workflow).not.toContain("secrets.STRIPE_SECRET_KEY");
  });

  it("keeps all KLYX data mutations inside ephemeral local Supabase", () => {
    expect(workflow).toContain('KLYX_GOLDEN_PATH_LOCAL_SUPABASE: "true"');
    expect(workflow).toContain("supabase start");
    expect(workflow).toContain("supabase stop --no-backup || true");
    expect(workflow).toContain(
      "http://127.0.0.1:54321|http://localhost:54321"
    );
    expect(proof).toContain("assertGoldenPathIsolation");
    expect(proof).toContain("if (!localSupabase)");
    expect(proof).toContain(
      'appOrigin !== "http://127.0.0.1:3100"'
    );
  });

  it("creates the accepted booking through existing KLYX APIs before Stripe", () => {
    const lifecycle = "node scripts/golden-path-client-lifecycle.mjs";
    const stripeProof =
      "node scripts/golden-path-stripe-network-checkout.mjs";

    expect(workflow).toContain(lifecycle);
    expect(workflow).toContain(stripeProof);
    expect(workflow.indexOf(lifecycle)).toBeLessThan(
      workflow.indexOf(stripeProof)
    );
    expect(workflow.indexOf("npm run start -- -p 3100")).toBeLessThan(
      workflow.indexOf(lifecycle)
    );
  });

  it("proves a real Stripe test Checkout Session and KLYX reuse semantics", () => {
    expect(proof).toContain('path: "/api/stripe/create-checkout-session"');
    expect(proof).toContain("new Stripe(stripeSecretKey)");
    expect(proof).toContain("stripe.checkout.sessions.retrieve");
    expect(proof).toContain('remoteSession.livemode !== false');
    expect(proof).toContain('remoteSession.status !== "open"');
    expect(proof).toContain('remoteSession.payment_status !== "unpaid"');
    expect(proof).toContain("remoteSession.metadata?.booking_id !== booking.id");
    expect(proof).toContain('checkout?.paymentMode !== "platform_test_only"');
    expect(proof).toContain("reusedCheckout?.reused !== true");
    expect(proof).toContain('payment_status !== "checkout_created"');
  });

  it("does not automate Stripe-hosted payment UI and expires the test Session", () => {
    expect(proof).not.toContain("playwright");
    expect(proof).not.toContain("page.goto");
    expect(proof).not.toContain("4242 4242 4242 4242");
    expect(proof).toContain("stripe.checkout.sessions.expire");
    expect(workflow).toContain("stripe-network-proof/");
  });
});
