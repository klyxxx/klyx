import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const heldCore = read(
  "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
);
const migrationSql = read(
  "supabase/migrations/20260918162000_klyx_settlement_claim_canonical_stripe_identity.sql"
);

describe("Mission 3 platform-held canonical Stripe identity integration", () => {
  it("routes platform-held provider identity through the #799 canonical helper", () => {
    expect(heldCore).toContain("getProfileAccountStripeConnectIdentity");
    expect(heldCore).toContain("assertStripeConnectIdentityUsable");
    expect(heldCore).toContain("STRIPE_CONNECT_IDENTITY_CONFLICT");
    expect(heldCore).not.toContain('from "@/lib/stripe-connect-account"');
  });

  it("claims settlement release only against account_stripe_connect_identities", () => {
    expect(migrationSql).toContain(
      "from public.account_stripe_connect_identities as i"
    );
    expect(migrationSql).toContain("i.identity_state");
    expect(migrationSql).toContain("coalesce(v_account_connect_state, '') <> 'linked'");
    expect(migrationSql).not.toContain("a.stripe_connect_state");
    expect(migrationSql).not.toContain("a.stripe_account_id");
  });
});
