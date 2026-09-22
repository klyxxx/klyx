import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX canonical Stripe Connect manual resolution", () => {
  it("records every manual resolution in an append-only domain journal", () => {
    const migration = read(
      "supabase/migrations/20260922213000_klyx_stripe_connect_identity_manual_resolution.sql"
    );

    expect(migration).toContain(
      "account_stripe_connect_identity_events"
    );
    expect(migration).toContain(
      "KLYX_STRIPE_CONNECT_IDENTITY_EVENT_IMMUTABLE"
    );
    expect(migration).toContain(
      "before update or delete"
    );
    expect(migration).toContain(
      "event_type in ('manual_resolution')"
    );
  });

  it("can resolve only an account already present in the recorded conflict", () => {
    const migration = read(
      "supabase/migrations/20260922213000_klyx_stripe_connect_identity_manual_resolution.sql"
    );

    expect(migration).toContain(
      "v_selected = any(v_row.conflicting_stripe_account_ids)"
    );
    expect(migration).toContain(
      "KLYX_STRIPE_CONNECT_RESOLUTION_SELECTION_NOT_IN_CONFLICT"
    );
    expect(migration).toContain(
      "KLYX_STRIPE_CONNECT_RESOLUTION_ACCOUNT_ALREADY_OWNED"
    );
    expect(migration).toContain("for update");
  });

  it("marks the resolved canonical account explicitly instead of deleting historical evidence", () => {
    const migration = read(
      "supabase/migrations/20260922213000_klyx_stripe_connect_identity_manual_resolution.sql"
    );

    expect(migration).toContain("manually_resolved = true");
    expect(migration).toContain("resolved_at = now()");
    expect(migration).toContain("resolution_reason_code = v_reason");
    expect(migration).toContain("resolution_evidence");
    expect(migration).not.toContain(
      "delete from public.profiles"
    );
  });

  it("prevents legacy profile Stripe ids from overriding an audited canonical resolution", () => {
    const identity = read(
      "lib/stripe-connect-account-identity.ts"
    );

    const manualFence = identity.indexOf(
      'canonical.manually_resolved === true'
    );
    const historyEvidence = identity.indexOf(
      "const canonicalStripeId"
    );

    expect(manualFence).toBeGreaterThan(-1);
    expect(historyEvidence).toBeGreaterThan(manualFence);
    expect(identity).toContain(
      "return normalizeIdentity(accountId, canonical)"
    );
  });

  it("reopens review when new contradictory identity evidence appears later", () => {
    const identity = read(
      "lib/stripe-connect-account-identity.ts"
    );

    expect(identity).toContain("manually_resolved: false");
    expect(identity).toContain("resolved_at: null");
    expect(identity).toContain("resolution_reason_code: null");
    expect(identity).toContain("resolution_evidence: {}");
    expect(identity).toContain(
      "STRIPE_CONNECT_IDENTITY_CONFLICT"
    );
  });

  it("requires Founder auth and live Stripe verification before the resolution RPC", () => {
    const route = read(
      "app/api/founder/stripe-connect-identities/route.ts"
    );

    expect(route).toContain("requireKlyxFounder");
    expect(route).toContain('mode !== "live"');
    expect(route).toContain('key.startsWith("sk_live_")');
    expect(route).toContain(
      "stripe.accounts.retrieve(stripeAccountId)"
    );
    expect(route).toContain(
      "klyx_resolve_account_stripe_connect_identity"
    );
  });

  it("stores only non-PII Stripe readiness evidence in the resolution event", () => {
    const route = read(
      "app/api/founder/stripe-connect-identities/route.ts"
    );

    expect(route).toContain("stripeVerifiedAt");
    expect(route).toContain("transferCapability");
    expect(route).toContain("currentlyDueCount");
    expect(route).not.toContain("connectedAccount.email");
    expect(route).not.toContain("connectedAccount.individual");
    expect(route).not.toContain("connectedAccount.external_accounts");
  });
});
