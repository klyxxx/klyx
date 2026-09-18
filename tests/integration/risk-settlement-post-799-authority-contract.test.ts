import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

describe("post-#799 Risk/Settlement integration authority", () => {
  it("keeps accounts.id as the canonical user authority", () => {
    const risk = source("lib/account-risk-server.ts");

    expect(risk).toContain('.from("accounts")');
    expect(risk).toContain('.eq("id", accountId)');
    expect(risk).toContain("account.id");
  });

  it("uses only #799 account-first Stripe Connect authority", () => {
    const adapter = source("lib/stripe-connect-account.ts");
    const identity = source("lib/stripe-connect-account-identity.ts");

    expect(adapter).toContain("getAccountStripeConnectIdentity");
    expect(adapter).toContain("persistAccountStripeConnectIdentity");
    expect(adapter).toContain("markAccountStripeConnectIdentityForReview");
    expect(adapter).not.toContain("klyx_bind_account_stripe_connect");
    expect(adapter).not.toContain('.from("accounts")');

    expect(identity).toContain('.from("account_stripe_connect_identities")');
    expect(identity).toContain('.from("profiles")');
    expect(identity).toContain("stripe_account_id");
  });

  it("does not reintroduce the superseded accounts.stripe_account_id schema", () => {
    for (const file of [
      "supabase/migrations/20260914194500_klyx_account_level_stripe_connect.sql",
      "supabase/migrations/20260914194600_klyx_account_stripe_bind_review_result.sql",
      "supabase/migrations/20260914194700_klyx_split_canonical_stripe_guard.sql",
      "supabase/migrations/20260914194800_klyx_stripe_connect_review_account_index.sql",
    ]) {
      expect(fs.existsSync(path.join(root, file))).toBe(false);
    }
  });

  it("keeps certified destination-charge legacy checkout intact", () => {
    const legacy = source(
      "app/api/stripe/create-checkout-session/route-core.ts"
    );
    const dispatcher = source(
      "app/api/stripe/create-checkout-session/route.ts"
    );

    expect(legacy).toContain("application_fee_amount");
    expect(legacy).toContain("transfer_data");
    expect(legacy).toContain('"connect_destination"');
    expect(dispatcher).toContain("return corePost(request)");
  });

  it("keeps Platform-Held TEST-only and group/split disabled", () => {
    const heldRoute = source(
      "app/api/stripe/create-checkout-session/route-platform-held.ts"
    );
    const heldCore = source(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );
    const settlement = source("lib/booking-settlement-server.ts");

    expect(heldRoute).toContain('key.startsWith("sk_live_")');
    expect(heldRoute).toContain('key.startsWith("sk_test_")');
    expect(heldCore).toContain("KLYX_PLATFORM_HELD_GROUP_NOT_SUPPORTED");
    expect(heldCore).toContain("KLYX_PLATFORM_HELD_SPLIT_NOT_SUPPORTED");

    expect(settlement).toContain('key.startsWith("sk_live_")');
    expect(settlement).toContain('key.startsWith("sk_test_")');
    expect(settlement).toContain("stripe.transfers.create");
    expect(settlement).toContain("transfers.createReversal");
  });
});
