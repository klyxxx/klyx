import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260920091000_klyx_orchestrator_foundation.sql"
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
    expect(repository).toContain(
      '"klyx_complete_settlement_workflow"'
    );
    expect(repository).toContain(
      'actorType: "server" | "system" | "operator"'
    );
  });
});
