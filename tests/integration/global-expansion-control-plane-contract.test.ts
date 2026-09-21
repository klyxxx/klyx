import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260921173000_klyx_global_expansion_control_plane.sql"
  ),
  "utf8"
);

const server = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/global-expansion-control-plane-server.ts"
  ),
  "utf8"
);

const founderRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/founder/expansion/markets/route.ts"
  ),
  "utf8"
);

const marketPolicyServer = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-market-policy-server.ts"),
  "utf8"
);

const documentation = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/KLYX_GLOBAL_EXPANSION_CONTROL_PLANE.md"
  ),
  "utf8"
);

describe("KLYX Global Expansion Control Plane", () => {
  it("stores market rollout as data and starts fail-closed", () => {
    expect(migration).toContain(
      "create table if not exists public.klyx_markets"
    );
    expect(migration).toContain(
      "rollout_state text not null default 'DISABLED'"
    );

    for (const state of [
      "DISABLED",
      "INTERNAL",
      "TEST",
      "PILOT",
      "LIMITED",
      "GENERAL",
    ]) {
      expect(migration).toContain("'" + state + "'");
    }

    expect(migration).not.toMatch(/default\s+'BE'/i);
    expect(migration).not.toMatch(/default\s+'FR'/i);
    expect(migration).not.toMatch(/default\s+'BR'/i);
    expect(migration).not.toMatch(/default\s+'US'/i);
    expect(migration).not.toMatch(/default\s+'JP'/i);
  });

  it("keeps health operational instead of duplicating Mission 17", () => {
    expect(server).toContain("getKlyxOpsCapabilityDecision");
    expect(server).toContain('health === "SUSPENDED"');
    expect(server).toContain('health === "DEGRADED"');
    expect(server).toContain("ops_incidents_current");
    expect(documentation).toContain(
      "DEGRADED and SUSPENDED are effective operational states"
    );
  });

  it("composes existing payment authority instead of copying tax or payment truth", () => {
    expect(server).toContain("resolveKlyxMarketPaymentPolicy");
    expect(server).toContain("paymentProvider: paymentProvider");
    expect(marketPolicyServer).toContain(
      '.eq("provider", paymentProvider)'
    );
    expect(marketPolicyServer).toContain(
      'params.paymentProvider?.trim().toLowerCase() || "stripe"'
    );
    expect(server).toContain("payment:");
    expect(migration).not.toContain("stripe_account_id");
    expect(migration).not.toContain("payment_intent");
    expect(documentation).toContain("klyx_market_payment_rules");
    expect(documentation).toContain(
      "klyx_payment_currency_capabilities"
    );
  });

  it("keeps economic and activity requirements declarative", () => {
    expect(migration).toContain("klyx_market_requirements");
    expect(migration).toContain("'economic_identity'");
    expect(migration).toContain("'account_capability'");
    expect(documentation).toContain(
      "account_capability_qualifications"
    );
    expect(documentation).toContain("Economic Eligibility");
  });

  it("keeps feature availability market-driven", () => {
    expect(migration).toContain("klyx_market_features");
    expect(migration).toContain("feature_key");
    expect(server).toContain("feature_config_missing");
    expect(server).toContain("feature_rollout");
  });

  it("uses optimistic version fencing and append-only audit", () => {
    expect(migration).toContain("KLYX_EXPANSION_VERSION_CONFLICT");
    expect(migration).toContain(
      "klyx_market_control_events_append_only_guard"
    );
    expect(migration).toContain(
      "KLYX_MARKET_CONTROL_EVENTS_APPEND_ONLY"
    );
    expect(migration).toContain("version = version + 1");
  });

  it("keeps all mutation behind Founder + service-role RPCs", () => {
    expect(founderRoute).toContain("requireKlyxFounder");
    expect(founderRoute).toContain(
      "klyx_upsert_market_manifest"
    );
    expect(founderRoute).toContain(
      "klyx_transition_market_rollout"
    );
    expect(founderRoute).toContain("klyx_set_market_feature");
    expect(founderRoute).toContain(
      "klyx_set_market_requirement"
    );

    expect(migration).toContain(
      "grant select on table public.klyx_markets to service_role"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_transition_market_rollout"
    );
  });

  it("never lets GENERAL override another authority", () => {
    expect(server).toContain("blockers.length === 0");
    expect(server).toContain("operations:");
    expect(server).toContain("requirement_blocked:");
    expect(server).toContain("market_rollout");
    expect(documentation).toContain(
      "GENERAL is not an authorization bypass"
    );
  });

  it("does not activate Stripe LIVE or deploy infrastructure", () => {
    expect(server).not.toContain("new Stripe");
    expect(founderRoute).not.toContain("new Stripe");
    expect(migration).not.toContain("stripe.transfers");
    expect(documentation).toContain("Stripe LIVE remains unchanged");
    expect(documentation).toContain(
      "does not deploy Vercel or Supabase production migrations"
    );
  });
});
