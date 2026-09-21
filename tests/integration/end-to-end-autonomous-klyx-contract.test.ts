import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const stateMachine = read("lib/brain/orchestrator/state-machine.ts");
const repository = read("lib/brain/orchestrator/repository.ts");
const assistantWorkflow = read("lib/brain/orchestrator/assistant-workflow.ts");
const foundation = read(
  "supabase/migrations/20260920091000_klyx_orchestrator_foundation.sql"
);
const continuity = read(
  "supabase/migrations/20260921173000_klyx_end_to_end_autonomous_continuity.sql"
);
const durableJobs = read(
  "supabase/migrations/20260920190000_klyx_durable_jobs_retry_dlq.sql"
);
const checkout = read("app/api/stripe/create-checkout-session/route-core.ts");
const splitCheckout = read(
  "app/api/bookings/split-missions/[id]/checkout/route-core.ts"
);
const eligibility = read(
  "supabase/migrations/20260920110000_klyx_economic_settlement_eligibility.sql"
);
const documentation = read("docs/KLYX_END_TO_END_AUTONOMOUS_CERTIFICATION.md");

describe("Mission 19 end-to-end autonomous KLYX contract", () => {
  it("keeps the full demander and gagner lifecycles in deterministic server state", () => {
    for (const step of [
      "intention",
      "comprehension",
      "plan",
      "search",
      "matching",
      "quote",
      "negotiation_confirmation",
      "booking",
      "payment",
      "execution",
      "tracking",
      "incident",
      "refund_replacement",
      "closure",
      "skill",
      "opportunities",
      "eligibility",
      "proposal",
      "acceptance",
      "mission",
      "settlement",
    ]) {
      expect(stateMachine).toContain(`"${step}"`);
    }

    expect(stateMachine).toContain(
      "assistantMayExecuteActionDirectly"
    );
    expect(stateMachine).toContain("return false;");
  });

  it("survives conversation deletion by rebinding only an orphaned workflow for the same account/profile", () => {
    expect(foundation).toContain(
      "conversation_id uuid references public.brain_conversations(id) on delete set null"
    );
    expect(continuity).toContain(
      "create or replace function public.klyx_resume_orphaned_workflow"
    );
    expect(continuity).toContain("w.account_id = p_account_id");
    expect(continuity).toContain("w.profile_id = p_profile_id");
    expect(continuity).toContain("w.conversation_id is null");
    expect(continuity).toContain("for update;");
    expect(continuity).toContain("version = version + 1");
    expect(continuity).toContain("'workflow_conversation_rebound'");
    expect(continuity).toContain("to service_role");
    expect(continuity).toContain("from public, anon, authenticated");

    const exactLookup = repository.indexOf(
      "findActiveWorkflowForConversation"
    );
    const orphanRecovery = repository.indexOf(
      "resumeOrphanedWorkflow"
    );
    expect(exactLookup).toBeGreaterThan(-1);
    expect(orphanRecovery).toBeGreaterThan(-1);
    expect(repository).toContain(
      '"klyx_resume_orphaned_workflow"'
    );
    const createOrResumeStart = repository.indexOf(
      "export async function createOrResumeWorkflow"
    );
    const createOrResumeEnd = repository.indexOf(
      "export async function transitionWorkflow"
    );
    const createOrResume = repository.slice(
      createOrResumeStart,
      createOrResumeEnd
    );

    expect(createOrResumeStart).toBeGreaterThan(-1);
    expect(createOrResumeEnd).toBeGreaterThan(createOrResumeStart);
    expect(createOrResume).toContain(
      '"klyx_create_or_resume_workflow"'
    );
    expect(createOrResume).toContain("if (!current) {");
    expect(createOrResume).not.toContain(
      "if (current) return current;"
    );
    expect(assistantWorkflow).toContain(
      "profileId: params.profileId"
    );
  });

  it("does not depend on the LLM or browser as mutation authority", () => {
    expect(foundation).toContain(
      "Persistent workflow state for the unified assistant."
    );
    expect(foundation).toContain(
      "Sensitive mutations are never executed by the LLM."
    );
    expect(repository).toContain(
      "automaticSensitiveExecutionAllowed: false"
    );
    expect(documentation).toContain(
      "browser state != workflow truth"
    );
    expect(documentation).toContain(
      "LLM context != workflow truth"
    );
  });

  it("makes double-click, replay, worker crash and retry converge on durable identities", () => {
    expect(foundation).toContain(
      "unique (workflow_id, idempotency_key)"
    );
    expect(durableJobs).toContain(
      "unique (job_type, idempotency_key)"
    );
    expect(durableJobs).toContain("for update skip locked");
    expect(durableJobs).toContain("lease_token");
    expect(durableJobs).toContain("lease_expires_at");
    expect(durableJobs).toContain("attempt_count");
    expect(durableJobs).toContain("max_attempts");
    expect(documentation).toContain(
      "At-least-once execution is safe through durable idempotency"
    );
  });

  it("freezes booking economics against later catalog price edits", () => {
    const snapshotRead = checkout.indexOf(
      "booking.subtotal_amount_minor ??"
    );
    const catalogFallback = checkout.indexOf(
      "legacyFallbackAmount"
    );

    expect(snapshotRead).toBeGreaterThan(-1);
    expect(catalogFallback).toBeGreaterThan(-1);
    expect(snapshotRead).toBeLessThan(
      checkout.lastIndexOf("legacyFallbackAmount")
    );
    expect(checkout).toContain(
      "KLYX_GLOBAL_MONEY_SNAPSHOT_REQUIRED"
    );

    expect(splitCheckout).toContain("price_snapshot");
    expect(splitCheckout).toContain("invalidated_at");
    expect(documentation).toContain(
      "A later catalog price edit must not silently change the already-created booking amount."
    );
  });

  it("keeps new settlement money movement behind fresh KLYX eligibility", () => {
    expect(eligibility).toContain(
      "KLYX MISSION 11 — ECONOMIC ELIGIBILITY -> SETTLEMENT GATE"
    );
    expect(eligibility).toContain(
      "economic_settlement_eligibility_decisions"
    );
    expect(eligibility).toContain("'allowed'");
    expect(eligibility).toContain("'human_review'");
    expect(eligibility).toContain("'blocked'");
    expect(documentation).toContain(
      "Stripe payouts_enabled = true"
    );
    expect(documentation).toContain(
      "If KLYX eligibility becomes blocked before a new Transfer, release must remain blocked."
    );
  });

  it("keeps static contract checks separate from runtime certification", () => {
    expect(documentation).toContain(
      "Static contracts prove that the architecture contains the required boundaries. They are not, by themselves, runtime certification."
    );

    for (const scenario of [
      "Browser closed then reopened",
      "Conversation deleted",
      "LLM model changed",
      "Webhook delayed",
      "Worker crash",
      "Retry",
      "Double click",
      "Action replay",
      "Price modified during workflow",
      "Beneficiary becomes ineligible before Settlement",
    ]) {
      expect(documentation).toContain(scenario);
    }
  });
});
