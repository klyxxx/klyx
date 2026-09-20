import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260920223000_klyx_observability_financial_monitoring.sql"
  ),
  "utf8"
);
const server = fs.readFileSync(
  path.join(root, "lib/observability-financial-monitoring-server.ts"),
  "utf8"
);
const route = fs.readFileSync(
  path.join(root, "app/api/founder/operations/monitoring/route.ts"),
  "utf8"
);
const readiness = fs.readFileSync(
  path.join(root, "app/api/founder/transaction-readiness/route.ts"),
  "utf8"
);
const doc = fs.readFileSync(
  path.join(root, "docs/KLYX_OBSERVABILITY_FINANCIAL_MONITORING.md"),
  "utf8"
);

describe("Mission 16 observability + financial monitoring contract", () => {
  it("builds read-only projections over existing canonical authorities", () => {
    expect(migration).toContain(
      "create or replace view public.ops_observability_signals_current"
    );
    expect(migration).toContain(
      "create or replace view public.financial_monitoring_signals_current"
    );
    expect(migration).toContain(
      "create or replace view public.financial_monitoring_flow_24h"
    );

    for (const relation of [
      "ops_operations",
      "ops_events",
      "ops_durable_jobs",
      "ops_human_cases",
      "financial_reconciliation_current",
      "booking_settlements",
      "financial_ledger_current",
    ]) {
      expect(migration).toContain(`public.${relation}`);
    }
  });

  it("keeps monitoring strictly read-only and service-role SELECT-only", () => {
    for (const view of [
      "ops_observability_signals_current",
      "financial_monitoring_signals_current",
      "financial_monitoring_flow_24h",
    ]) {
      expect(migration).toContain(
        `revoke all privileges on table public.${view}`
      );
      expect(migration).toContain(
        `grant select on table public.${view}`
      );
    }

    expect(migration).not.toContain(
      "create table if not exists public.ops_monitoring_alerts"
    );
    expect(migration).not.toContain(
      "create table if not exists public.ops_incidents"
    );
    expect(migration).not.toContain("security definer");
  });

  it("never aggregates money across currencies", () => {
    expect(migration).toContain(
      "group by l.currency, l.movement_type"
    );
    expect(migration).toContain("sum(l.amount_minor)::numeric");
    expect(doc).toContain("Amounts are never summed across currencies.");
    expect(doc).toContain("zero-decimal currencies");
  });

  it("derives financial signals from reconciliation, settlement and ledger truth", () => {
    expect(migration).toContain(
      "where r.state in ('reconciliation', 'human_review')"
    );
    expect(migration).toContain(
      "where s.state in ('review_required', 'release_claimed', 'release_failed')"
    );
    expect(migration).toContain(
      "where l.beneficiary_ref like 'unresolved-profile:%'"
    );

    expect(migration).toContain("'settlement_release_claimed'");
    expect(migration).toContain("'info'::text as severity");
  });

  it("keeps settlement staleness a runtime monitoring policy, not SQL authority", () => {
    expect(server).toContain("staleReleaseSeconds ?? 900");
    expect(server).toContain(
      'row.signal_type === "settlement_release_claimed"'
    );
    expect(server).toContain(
      '"SETTLEMENT_RELEASE_CLAIM_STALE"'
    );
    expect(server).toContain("ageSeconds >= staleReleaseSeconds");

    expect(migration).not.toContain("interval '15 minutes'");
    expect(migration).not.toContain("SETTLEMENT_RELEASE_CLAIM_STALE");
  });

  it("keeps the server boundary private and Founder-only", () => {
    expect(server).toContain('import "server-only"');
    expect(route).toContain("await requireKlyxFounder()");
    expect(route).toContain(
      "getKlyxObservabilityFinancialMonitoringSnapshot"
    );
    expect(route).toContain(
      'const ROUTE = "/api/founder/operations/monitoring"'
    );
  });

  it("does not introduce Mission 17 incident or financial side effects", () => {
    const mission = [migration, server, route, doc].join("\n");

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
      "klyx_set_ops_capability_control",
      "klyx_auto_redrive_durable_job",
      "insert into public.ops_incidents",
    ]) {
      expect(mission).not.toContain(forbidden);
    }

    expect(doc).toContain(
      "Circuit breaking and incident state belong to Mission 17."
    );
  });

  it("adds Mission 16 projections to Founder transaction readiness", () => {
    for (const relation of [
      "ops_observability_signals_current",
      "financial_monitoring_signals_current",
      "financial_monitoring_flow_24h",
    ]) {
      expect(readiness).toContain(`"${relation}"`);
    }
  });
});
