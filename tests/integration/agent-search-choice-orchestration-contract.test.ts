import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260822003000_klyx_agent_execution_state.sql"
);
const executeRoute = read("app/api/agent/plans/execute/route.ts");
const plansRoute = read("app/api/agent/plans/route.ts");
const agent = read("lib/client-agent.ts");
const golden = read("scripts/golden-path-agent-orchestration.mjs");
const workflow = read(".github/workflows/klyx-golden-path.yml");

describe("KLYX reversible agent search/choice orchestration", () => {
  it("persists durable execution state and a server-only journal", () => {
    expect(migration).toContain("selected_provider_id uuid");
    expect(migration).toContain("selected_user_service_id uuid");
    expect(migration).toContain("search_snapshot jsonb");
    expect(migration).toContain("execution_status text");
    expect(migration).toContain("execution_revision integer");
    expect(migration).toContain("client_agent_plan_events");
    expect(migration).toContain("client_agent_plan_events_unique");
    expect(migration).toContain("revoke all privileges on table public.client_agent_plans");
    expect(migration).toContain("revoke all privileges on table public.client_agent_plan_events");
    expect(migration).toContain("to service_role");
  });

  it("claims execution atomically and reuses a persisted provider choice", () => {
    expect(migration).toContain("klyx_claim_client_agent_execution");
    expect(migration).toContain("for update");
    expect(migration).toContain("return query select 'reuse'::text");
    expect(migration).toContain("return query select 'busy'::text");
    expect(migration).toContain("execution_revision = v_revision");
    expect(migration).toContain(
      "revoke all on function public.klyx_claim_client_agent_execution(uuid, uuid)"
    );
    expect(migration).toContain("to service_role");
    expect(executeRoute).toContain('claim.action === "reuse"');
    expect(executeRoute).toContain("reused: true");
  });

  it("resolves the plan service through the canonical Supabase catalog", () => {
    expect(plansRoute).toContain('.from("services")');
    expect(plansRoute).toContain('select("slug, name")');
    expect(plansRoute).toContain("detectCatalogServiceCandidates");
    expect(plansRoute).toContain("mergeServiceCandidates");
    expect(plansRoute).toContain("canonicalServiceSlugs.has(slug)");
    expect(plansRoute).toContain("serviceCandidates,");
    expect(agent).toContain("serviceCandidates?: ServiceCandidate[]");
    expect(agent).not.toContain("const SERVICE_LABELS");
    expect(agent).not.toContain("!SERVICE_LABELS[serviceSlug]");
  });

  it("uses the canonical provider search and only auto-selects an exact match", () => {
    expect(executeRoute).toContain(
      'GET as providerSearchCore'
    );
    expect(executeRoute).toContain("await providerSearchCore(searchRequest(initialPlan))");
    expect(executeRoute).toContain("searchPayload.exactCount > 0");
    expect(executeRoute).toContain("provider.isExactMatch");
    expect(executeRoute).toContain('requiresConfirmation: "choose"');
    expect(executeRoute).toContain('requiresConfirmation: "book"');
    expect(executeRoute).toContain('next_action: "book"');
  });

  it("keeps booking and payment outside automatic execution", () => {
    expect(executeRoute).not.toContain('/api/bookings/create');
    expect(executeRoute).not.toContain('create-checkout-session');
    expect(executeRoute).not.toContain('stripe');
    expect(executeRoute).not.toContain('.from("bookings").insert');
    expect(executeRoute).not.toContain('.from("service_quotes").insert');
    expect(agent).toContain('id: "book"');
    expect(agent).toContain('id: "pay"');
    expect(agent).toContain("requiresConfirmation: true");
    expect(plansRoute).toContain(
      "Cette étape doit être accomplie par l’action KLYX correspondante."
    );
    expect(plansRoute).toContain('if (stepId !== "complete")');
  });

  it("journals search, selection, confirmation and safe failures", () => {
    for (const eventType of [
      "search_started",
      "search_succeeded",
      "provider_selected",
      "confirmation_required",
      "execution_failed",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
      expect(executeRoute).toContain(`"${eventType}"`);
    }
    expect(executeRoute).toContain(
      'onConflict: "plan_id,execution_revision,event_type"'
    );
    expect(executeRoute).toContain("ignoreDuplicates: true");
  });

  it("proves idempotence and confirmation boundary in Golden", () => {
    expect(golden).toContain('executionRetryReused: true');
    expect(golden).toContain('bookingConfirmationRequired: true');
    expect(golden).toContain('bookingCreatedAutomatically: false');
    expect(golden).toContain('paymentTriggeredAutomatically: false');
    expect(golden).toContain('retried.reused === true');
    expect(golden).toContain('events?.length === 4');
    expect(golden).toContain('Number(bookingsAfter ?? 0) === Number(bookingsBefore ?? 0)');
    expect(workflow).toContain(
      "node scripts/golden-path-agent-orchestration.mjs"
    );
    expect(workflow).toContain('      - "app/api/agent/**"');
    expect(workflow).toContain('      - "lib/client-agent.ts"');
  });
});
