import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260920225000_klyx_circuit_breakers_incident_engine.sql"
  ),
  "utf8"
);
const server = fs.readFileSync(
  path.join(root, "lib/incident-engine-server.ts"),
  "utf8"
);
const route = fs.readFileSync(
  path.join(root, "app/api/founder/operations/incidents/route.ts"),
  "utf8"
);
const readiness = fs.readFileSync(
  path.join(root, "app/api/founder/transaction-readiness/route.ts"),
  "utf8"
);
const doc = fs.readFileSync(
  path.join(root, "docs/KLYX_CIRCUIT_BREAKERS_INCIDENT_ENGINE.md"),
  "utf8"
);

describe("Mission 17 circuit breakers + incident engine contract", () => {
  it("adds operational incident state without replacing domain truth", () => {
    expect(migration).toContain(
      "create table if not exists public.ops_incidents"
    );
    expect(migration).toContain(
      "create table if not exists public.ops_incident_events"
    );
    expect(migration).toContain(
      "create table if not exists public.ops_incident_controls"
    );
    expect(migration).toContain(
      "create or replace view public.ops_incidents_current"
    );
    expect(doc).toContain(
      "Incidents coordinate response. They do not replace canonical truth."
    );
  });

  it("reuses the existing Operations control plane as the only breaker authority", () => {
    expect(migration).toContain(
      "from public.klyx_ops_set_manual_control("
    );
    expect(migration).toContain("p_scope_type => 'incident'");
    expect(migration).toContain(
      "p_scope_key => v_incident.id::text"
    );
    expect(migration).toContain("p_state => 'DISABLED'");
    expect(migration).toContain("p_state => 'ENABLED'");
    expect(migration).toContain(
      "references public.ops_capability_controls(id)"
    );
    expect(doc).toContain(
      "Mission 17 never creates a second blocking authority."
    );
  });

  it("requires a structured breaker scope and incident lifecycle fencing", () => {
    expect(migration).toContain(
      "KLYX_OPS_INCIDENT_BREAKER_SCOPE_REQUIRED"
    );
    expect(migration).toContain(
      "KLYX_OPS_INCIDENT_VERSION_CONFLICT"
    );
    expect(migration).toContain(
      "KLYX_OPS_INCIDENT_ACTIVE_BREAKER"
    );
    expect(migration).toContain(
      "v_incident.status not in ('acknowledged', 'mitigating')"
    );
    expect(migration).toContain(
      "v_to_status in ('resolved', 'closed')"
    );
  });

  it("fails closed when an incident breaker link no longer represents an active control", () => {
    expect(migration).toContain(
      "KLYX_OPS_INCIDENT_BREAKER_STALE_LINK"
    );
    expect(migration).toContain(
      "v_active_control_state is distinct from 'DISABLED'"
    );
    expect(migration).toContain(
      "v_active_control_expires_at <= now()"
    );
  });

  it("preserves append-only incident audit", () => {
    expect(migration).toContain(
      "KLYX_OPS_INCIDENT_EVENTS_APPEND_ONLY"
    );
    expect(migration).toContain(
      "before update or delete on public.ops_incident_events"
    );
    expect(migration).toContain("'incident.opened'");
    expect(migration).toContain("'incident.circuit_opened'");
    expect(migration).toContain("'incident.circuit_closed'");
  });

  it("keeps HTTP mutations Founder-only and server-controlled", () => {
    expect(server).toContain('import "server-only"');
    expect(route).toContain("await requireKlyxFounder()");
    expect(route).toContain('action === "open"');
    expect(route).toContain('action === "transition"');
    expect(route).toContain('action === "open_circuit"');
    expect(route).toContain('action === "close_circuit"');
  });

  it("does not introduce financial side effects or autonomous recovery", () => {
    const mission = [migration, server, route, doc].join("\n");

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.payouts.create(",
      "klyx_redrive_dead_lettered_job(",
      "financial_ledger_events (",
      "update public.booking_settlements",
    ]) {
      expect(mission).not.toContain(forbidden);
    }

    expect(doc).toContain(
      "infer incident decisions with an LLM"
    );
  });

  it("adds Mission 17 relations to Founder readiness", () => {
    for (const relation of [
      "ops_incidents",
      "ops_incident_events",
      "ops_incident_controls",
      "ops_incidents_current",
    ]) {
      expect(readiness).toContain(`"${relation}"`);
    }
  });
});
