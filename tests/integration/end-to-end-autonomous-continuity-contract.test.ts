import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260921173000_klyx_end_to_end_autonomous_continuity.sql"
);
const repository = read("lib/brain/orchestrator/repository.ts");
const assistantWorkflow = read("lib/brain/orchestrator/assistant-workflow.ts");
const foundation = read(
  "supabase/migrations/20260920091000_klyx_orchestrator_foundation.sql"
);

describe("Mission 19 conversation-independent workflow continuity", () => {
  it("keeps workflow state when a conversation is deleted", () => {
    expect(foundation).toContain(
      "conversation_id uuid references public.brain_conversations(id) on delete set null"
    );
    expect(migration).toContain(
      "w.conversation_id is null"
    );
    expect(migration).toContain(
      "w.status in ('active', 'waiting', 'blocked')"
    );
  });

  it("rebinds only inside the same account/profile and validates the new conversation", () => {
    expect(migration).toContain("w.account_id = p_account_id");
    expect(migration).toContain("w.profile_id = p_profile_id");
    expect(migration).toContain("c.id = p_conversation_id");
    expect(migration).toContain("c.user_id = p_profile_id");
    expect(migration).toContain("KLYX_WORKFLOW_PROFILE_ACCOUNT_MISMATCH");
    expect(migration).toContain("KLYX_WORKFLOW_CONVERSATION_PROFILE_MISMATCH");
  });

  it("makes recovery atomic, versioned and auditable", () => {
    expect(migration).toContain("for update;");
    expect(migration).toContain("version = version + 1");
    expect(migration).toContain("'workflow_conversation_rebound'");
    expect(migration).toContain("'conversation_continuity_recovery'");
    expect(foundation).toContain("KLYX_WORKFLOW_EVENT_IMMUTABLE");
  });

  it("keeps the recovery RPC server-only", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_resume_orphaned_workflow"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.klyx_resume_orphaned_workflow"
    );
    expect(migration).toContain("to service_role");
  });

  it("recovers before creating a replacement workflow", () => {
    const recovery = repository.indexOf("resumeOrphanedWorkflow({");
    const create = repository.indexOf('"klyx_create_or_resume_workflow"');

    expect(recovery).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(recovery);
    expect(repository).toContain('"klyx_resume_orphaned_workflow"');
  });

  it("scopes mission-management recovery to the active profile", () => {
    expect(assistantWorkflow).toContain(
      "profileId: params.profileId"
    );
    expect(repository).toContain(".eq(\"profile_id\", params.profileId)");
  });
});
