import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const platformWebhook = source("app/api/stripe/webhook/route.ts");
const connectWebhook = source("app/api/stripe/connect-webhook/route.ts");

function accountUpdater(route: string): string {
  const start = route.indexOf("async function updateConnectedAccount(");
  const end = route.indexOf("\n}\n", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return route.slice(start, end + 2);
}

function assertFreshStripeAccountBoundary(
  route: string,
  accountEventMarker: string
): void {
  const signatureVerification = route.indexOf("stripe.webhooks.constructEvent(");
  const accountEvent = route.indexOf(accountEventMarker);
  const accountSync = route.indexOf("updateConnectedAccount(", accountEvent);
  const updater = accountUpdater(route);
  const retrieve = updater.indexOf(
    "stripe.accounts.retrieve(signedAccount.id)"
  );
  const profileMutation = updater.indexOf('.from("profiles")');

  expect(signatureVerification).toBeGreaterThanOrEqual(0);
  expect(accountEvent).toBeGreaterThan(signatureVerification);
  expect(accountSync).toBeGreaterThan(accountEvent);
  expect(retrieve).toBeGreaterThanOrEqual(0);
  expect(profileMutation).toBeGreaterThan(retrieve);

  expect(updater).toContain(
    "stripe_onboarding_complete: Boolean(account.details_submitted)"
  );
  expect(updater).toContain(
    "stripe_charges_enabled: Boolean(account.charges_enabled)"
  );
  expect(updater).toContain(
    "stripe_payouts_enabled: Boolean(account.payouts_enabled)"
  );
  expect(updater).toContain('.eq("stripe_account_id", account.id)');

  expect(updater).not.toContain(
    "Boolean(signedAccount.details_submitted)"
  );
  expect(updater).not.toContain(
    "Boolean(signedAccount.charges_enabled)"
  );
  expect(updater).not.toContain(
    "Boolean(signedAccount.payouts_enabled)"
  );
}

describe("Stripe account.updated replay hardening", () => {
  it("keeps platform and Connect webhook secrets distinct", () => {
    expect(platformWebhook).toContain("STRIPE_WEBHOOK_SECRET");
    expect(platformWebhook).not.toContain("STRIPE_CONNECT_WEBHOOK_SECRET");
    expect(connectWebhook).toContain("STRIPE_CONNECT_WEBHOOK_SECRET");
    expect(connectWebhook).not.toContain("process.env.STRIPE_WEBHOOK_SECRET");
  });

  it("does not trust mutable account flags from a replayed platform event", () => {
    assertFreshStripeAccountBoundary(
      platformWebhook,
      'case "account.updated": {'
    );
  });

  it("does not trust mutable account flags from a replayed Connect event", () => {
    assertFreshStripeAccountBoundary(
      connectWebhook,
      'event.type === "account.updated"'
    );
  });
});
