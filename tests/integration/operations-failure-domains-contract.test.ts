import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

const migration = read(
  "supabase/migrations/20260920093000_klyx_operations_failure_domains.sql"
);
const opsServer = read("lib/ops-control-server.ts");
const founderRoute = read(
  "app/api/founder/operations/controls/route.ts"
);
const readiness = read(
  "app/api/founder/transaction-readiness/route.ts"
);
const doc = read("docs/KLYX_OPERATIONS_FAILURE_DOMAINS.md");

describe("Mission 13 Operations Foundation + Failure Domains", () => {
  it("creates a structured operations control plane without a second universal audit", () => {
    expect(migration).toContain(
      "create table if not exists public.ops_operations"
    );
    expect(migration).toContain(
      "create table if not exists public.ops_events"
    );
    expect(migration).toContain(
      "create table if not exists public.ops_capability_controls"
    );

    for (const field of [
      "failure_domain_type",
      "failure_domain_key",
      "market_id",
      "region_id",
      "country_code",
      "currency",
      "payment_provider",
      "capability",
      "dependency",
    ]) {
      expect(migration).toContain(field);
    }

    expect(migration).not.toContain("ops_audit_log");
    expect(doc).toContain("Operations does not replace domain truth");
  });

  it("keeps ops_events append-only for the application role", () => {
    expect(migration).toContain(
      "KLYX_OPS_EVENTS_APPEND_ONLY"
    );
    expect(migration).toContain(
      "before update or delete on public.ops_events"
    );
    expect(migration).toContain(
      "grant select, insert on table public.ops_events"
    );
    expect(migration).not.toContain(
      "grant all privileges on table public.ops_events"
    );
  });

  it("implements scoped manual kill switches with monotonic blocking semantics", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_ops_set_manual_control"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_ops_capability_decision"
    );
    expect(migration).toContain(
      "control.state = 'DISABLED'"
    );
    expect(migration).toContain(
      "control.expires_at is null or control.expires_at > now()"
    );
    expect(migration).toContain(
      "control.country_code is null or control.country_code = v_country_code"
    );
    expect(migration).toContain(
      "control.payment_provider is null"
    );
    expect(migration).toContain(
      "control.capability is null or control.capability = v_capability"
    );
    expect(doc).toContain(
      "`ENABLED` never overrides another matching `DISABLED` control"
    );
  });

  it("keeps the control-plane check fail-closed on missing or invalid database decisions", () => {
    expect(opsServer).toContain(
      "KLYX_OPS_CONTROL_PLANE_UNAVAILABLE"
    );
    expect(opsServer).toContain(
      "KLYX_OPS_CONTROL_PLANE_INVALID_DECISION"
    );
    expect(opsServer).toContain(
      "KLYX_OPS_CAPABILITY_DISABLED"
    );
    expect(opsServer).not.toContain("return { allowed: true");
  });

  it("exposes manual control only behind Founder authentication", () => {
    expect(founderRoute).toContain("requireKlyxFounder()");
    expect(founderRoute).toContain(
      '"klyx_ops_set_manual_control"'
    );
    expect(founderRoute).not.toContain(".delete()");
    expect(founderRoute).not.toContain("Stripe");
  });

  it("makes the founder transaction readiness gate depend on Operations", () => {
    expect(readiness).toContain('"ops_operations"');
    expect(readiness).toContain('"ops_events"');
    expect(readiness).toContain('"ops_capability_controls"');
    expect(readiness).toContain(
      "getKlyxOpsCapabilityDecision"
    );
    expect(readiness).toContain(
      'capability: "payments"'
    );
    expect(readiness).toContain(
      'paymentProvider: "stripe"'
    );
    expect(readiness).toContain("État fail-closed");
  });

  it("does not duplicate financial or business mutation engines", () => {
    const missionFiles = [
      migration,
      opsServer,
      founderRoute,
      doc,
    ].join("\n");

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "createReversal(",
      '.from("bookings").update(',
      '.from("booking_financial_ledger").insert(',
      "settlement finalize",
      "KYC approval",
    ]) {
      expect(missionFiles).not.toContain(forbidden);
    }
  });
});
