import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260920091000_klyx_orchestrator_foundation.sql"
);
const authorityMigration = read(
  "supabase/migrations/20260922171500_klyx_earn_settlement_completion_authority.sql"
);
const repository = read("lib/brain/orchestrator/repository.ts");

describe("KLYX orchestrator settlement terminal contract", () => {
  it("keeps settlement as a persistent step instead of completing on entry", () => {
    expect(migration).toContain(
      "when v_workflow.mode = 'request' and p_to_step = 'closure'"
    );
    expect(migration).not.toContain(
      "v_workflow.mode = 'earn' and p_to_step = 'settlement'"
    );
  });

  it("requires an explicit server-controlled completion RPC", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_complete_settlement_workflow"
    );
    expect(migration).toContain(
      "p_actor_type not in ('server', 'system', 'operator')"
    );
    expect(migration).toContain(
      "v_workflow.mode <> 'earn' or v_workflow.current_step <> 'settlement'"
    );
    expect(migration).toContain(
      "v_workflow.version <> p_expected_version"
    );
    expect(migration).toContain(
      "v_workflow.status not in ('active', 'waiting')"
    );
  });

  it("binds earn terminal completion to canonical released settlement truth", () => {
    expect(authorityMigration).toContain(
      "KLYX_WORKFLOW_SETTLEMENT_BOOKING_REQUIRED"
    );
    expect(authorityMigration).toContain(
      "KLYX_WORKFLOW_SETTLEMENT_BOOKING_NOT_COMPLETABLE"
    );
    expect(authorityMigration).toContain(
      "KLYX_WORKFLOW_SETTLEMENT_PROOF_REQUIRED"
    );
    expect(authorityMigration).toContain(
      "coalesce(v_booking.provider_id, v_booking.babysitter_id) is distinct from v_workflow.profile_id"
    );
    expect(authorityMigration).toContain(
      "v_settlement.state <> 'released'"
    );
    expect(authorityMigration).toContain(
      "coalesce(v_settlement.stripe_transfer_id, '') !~ '^tr_[A-Za-z0-9_]+$'"
    );
    expect(authorityMigration).toContain(
      "'settlement_authority', 'booking_settlements'"
    );
  });

  it("keeps settlement completion inaccessible to browser roles", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_complete_settlement_workflow"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.klyx_complete_settlement_workflow"
    );
    expect(migration).toContain("to service_role");
  });

  it("exposes completion only through the server repository boundary", () => {
    expect(repository).toContain(
      "export async function completeSettlementWorkflow"
    );
    expect(repository).toContain(
      'params.workflow.mode !== "earn"'
    );
    expect(repository).toContain(
      'params.workflow.currentStep !== "settlement"'
    );
    expect(repository).toContain("bookingId: string");
    expect(repository).toContain(
      "booking_id: params.bookingId"
    );
    expect(repository).toContain(
      '"klyx_complete_settlement_workflow"'
    );
    expect(repository).toContain(
      'actorType: "server" | "system" | "operator"'
    );
  });
});
