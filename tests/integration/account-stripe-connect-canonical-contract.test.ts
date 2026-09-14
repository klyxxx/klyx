import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const migration = read(
  "supabase/migrations/20260914190000_klyx_account_stripe_connect_identity.sql"
);
const identity = read("lib/stripe-connect-account-identity.ts");
const checkout = read("app/api/stripe/create-checkout-session/route.ts");
const groupCheckout = read(
  "app/api/stripe/create-group-checkout-session/route.ts"
);
const webhook = read("app/api/stripe/connect-webhook/route.ts");

describe("canonical account Stripe Connect identity", () => {
  it("is additive and never rewrites financial history", () => {
    expect(migration).toContain(
      "create table if not exists public.account_stripe_connect_identities"
    );
    expect(migration).not.toMatch(
      /drop\s+table|drop\s+column|delete\s+from\s+public\.bookings/i
    );
    expect(migration).not.toContain("update public.bookings");
  });

  it("backfills one historical Stripe id and records multi-id conflicts without selecting a winner", () => {
    expect(migration).toContain("cardinality(stripe_account_ids) = 1");
    expect(migration).toContain("cardinality(stripe_account_ids) > 1");
    expect(migration).toContain("'conflict'");
    expect(migration).toContain("stripe_account_id = null");
  });

  it("reconciles canonical identity against every historical profile at runtime", () => {
    expect(identity).toContain('.select("id, stripe_account_id")');
    expect(identity).toContain('.eq("account_id", accountId)');
    expect(identity).toContain("if (evidence.length > 1)");
    expect(identity).toContain("writeConflictIdentity");
    expect(identity).toContain('.eq("stripe_account_id", params.stripeAccountId)');
    expect(identity).toContain('.neq("account_id", params.accountId)');
  });

  it("fails closed for individual and group checkout conflicts", () => {
    expect(checkout).toContain("STRIPE_CONNECT_IDENTITY_CONFLICT");
    expect(groupCheckout).toContain("STRIPE_CONNECT_IDENTITY_CONFLICT");
    expect(checkout).toContain("destination: providerStripeAccountId");
    expect(groupCheckout).toContain("destination: providerStripeAccountId");
  });

  it("preserves signed webhook legacy updates while adding canonical fanout", () => {
    expect(webhook).toContain('.eq("stripe_account_id", account.id)');
    expect(webhook).toContain('.eq("account_id", identity.account_id)');
  });
});
