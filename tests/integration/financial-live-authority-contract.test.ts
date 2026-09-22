import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX canonical financial LIVE authority contract", () => {
  it("starts fail-closed and persists immutable state transitions", () => {
    const migration = read(
      "supabase/migrations/20260922205000_klyx_financial_live_authority.sql"
    );

    expect(migration).toContain("'DISABLED'");
    expect(migration).toContain("'CONTROLLED'");
    expect(migration).toContain("'GENERAL'");
    expect(migration).toContain("'INITIAL_FAIL_CLOSED'");
    expect(migration).toContain("klyx_set_financial_live_authority");
    expect(migration).toContain(
      "KLYX_FINANCIAL_LIVE_CONTROLLED_STAGE_REQUIRED"
    );
    expect(migration).toContain(
      "KLYX_FINANCIAL_LIVE_VERSION_CONFLICT"
    );
    expect(migration).toContain(
      "KLYX_FINANCIAL_LIVE_DISABLE_BEFORE_SHA_CHANGE"
    );
    expect(migration).toContain(
      "KLYX_FINANCIAL_LIVE_DISABLE_BEFORE_PROFILE_CHANGE"
    );
    expect(migration).toContain(
      "ops_financial_live_authority_events"
    );
    expect(migration).toContain(
      "KLYX_FINANCIAL_LIVE_AUTHORITY_EVENT_IMMUTABLE"
    );
  });

  it("makes database authority mandatory for every LIVE financial runtime", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");
    const authority = read("lib/financial-live-authority-server.ts");

    expect(runtime).toContain("requireKlyxFinancialLiveAuthority");
    expect(authority).toContain("KLYX_FINANCIAL_LIVE_DISABLED");
    expect(authority).toContain("KLYX_FINANCIAL_LIVE_SHA_MISMATCH");
    expect(authority).toContain(
      "KLYX_FINANCIAL_LIVE_CONTROLLED_PROFILE_BLOCKED"
    );
    expect(runtime).toContain('liveAuthority.state === "GENERAL"');
    expect(runtime).toContain('liveAuthority.state !== "CONTROLLED"');
  });

  it("does not let legacy LIVE environment flags choose CONTROLLED or GENERAL", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(runtime).not.toContain(
      'if (envTrue("KLYX_LIVE_PAYMENTS_ENABLED"))'
    );
    expect(runtime).not.toContain(
      'if (!envTrue("KLYX_LIVE_CERTIFICATION_ENABLED"))'
    );
    expect(runtime).not.toContain(
      'env("KLYX_LIVE_CERTIFICATION_PROFILE_ID")'
    );

    // The old general flag remains only as an additional GENERAL fence.
    expect(runtime).toContain(
      'if (!envTrue("KLYX_LIVE_PAYMENTS_ENABLED"))'
    );
  });

  it("routes legacy checkout cores through the same canonical financial runtime", () => {
    for (const path of [
      "app/api/stripe/create-checkout-session/route-core.ts",
      "app/api/stripe/create-group-checkout-session/route-core.ts",
      "app/api/bookings/split-missions/[id]/checkout/route-core.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("requireKlyxFinancialStripeRuntime");
      expect(source).not.toContain("assertStripeRuntimeReady()");
    }
  });

  it("exposes a Founder-only version-fenced state mutation surface", () => {
    const route = read("app/api/founder/financial-live/route.ts");

    expect(route).toContain("requireKlyxFounder");
    expect(route).toContain("expectedVersion");
    expect(route).toContain("KLYX_FINANCIAL_LIVE_DEPLOYMENT_SHA_MISMATCH");
    expect(route).toContain("KLYX_FINANCIAL_LIVE_DR_SHA_MISMATCH");
    expect(route).toContain(
      "KLYX_FINANCIAL_LIVE_FINANCIAL_CERTIFICATION_SHA_MISMATCH"
    );
    expect(route).toContain("klyx_set_financial_live_authority");
  });

  it("makes the canonical authority observable in health and Founder readiness", () => {
    const health = read("app/api/health/build/route.ts");
    const readiness = read(
      "app/api/founder/transaction-readiness/route.ts"
    );

    expect(health).toContain("liveAuthority");
    expect(health).toContain("authorizedShaMatchesDeployment");
    expect(readiness).toContain("financial_live_authority");
    expect(readiness).toContain("Autorité LIVE canonique");
  });

  it("certifies CONTROLLED through database truth instead of environment activation", () => {
    const verifier = read(
      "scripts/verify-klyx-production-financial-certification.mjs"
    );

    expect(verifier).toContain(
      'liveAuthority?.state === "CONTROLLED"'
    );
    expect(verifier).toContain(
      'from("ops_financial_live_authority")'
    );
    expect(verifier).toContain(
      "KLYX_CERT_LIVE_AUTHORITY_PROFILE_MISMATCH"
    );
    expect(verifier).not.toContain(
      "KLYX_CERT_GENERAL_LIVE_MUST_REMAIN_OFF"
    );
  });
});
