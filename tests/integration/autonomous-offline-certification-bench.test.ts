import fs from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("autonomous offline durable orchestration contract", () => {
  it("keeps the orchestration core independent from Supabase and Stripe SDKs", () => {
    const engine = read("lib/durable-orchestration-engine.ts");
    const fakes = read("lib/durable-orchestration-fakes.ts");

    expect(engine).not.toContain("@supabase/");
    expect(engine).not.toContain('from "stripe"');
    expect(engine).not.toContain("createClient(");
    expect(engine).not.toContain("new Stripe(");
    expect(engine).toContain("export interface KlyxOrchestrationStore");
    expect(engine).toContain("KlyxResilienceEngine");
    expect(fakes).toContain("class FakeSupabaseAdapter");
    expect(fakes).toContain("class FakeStripeAdapter");
  });

  it("stores LLM and browser identity only as non-authoritative interface context", () => {
    const engine = read("lib/durable-orchestration-engine.ts");

    expect(engine).toContain("export type KlyxInterfaceContext");
    expect(engine).toContain("conversationId: string | null");
    expect(engine).toContain("browserSessionId: string | null");
    expect(engine).toContain("llmModel: string | null");
    expect(engine).toContain("facts: Record<string, KlyxJsonValue>");
    expect(engine).toContain('kind: "set_interface_context"');
  });

  it("requires durable action boundaries for booking, payment, refund and settlement", () => {
    const engine = read("lib/durable-orchestration-engine.ts");

    for (const action of [
      "booking_create",
      "payment_capture",
      "refund_issue",
      "settlement_release",
    ]) {
      expect(engine).toContain(action);
    }
    expect(engine).toContain("KLYX_ORCHESTRATION_DIRECT_TRANSITION_FORBIDDEN");
    expect(engine).toContain("KLYX_ORCHESTRATION_SETTLEMENT_ELIGIBILITY_REQUIRED");
  });

  it("keeps explicit GAGNER completion between mission and settlement", () => {
    const engine = read("lib/durable-orchestration-engine.ts");

    expect(engine).toContain('"mission",\n  "completion",\n  "settlement"');
    expect(engine).toContain('from: "mission",\n    to: "completion"');
    expect(engine).toContain('from: "completion",\n    to: "settlement"');
    expect(engine).not.toContain('"mission->settlement"');
  });

  it("uses optimistic version fencing and deterministic command idempotency", () => {
    const engine = read("lib/durable-orchestration-engine.ts");
    const fakeStore = read("lib/durable-orchestration-fakes.ts");

    expect(engine).toContain("idempotencyKey");
    expect(engine).toContain("expectedVersion");
    expect(engine).toContain("KlyxOrchestrationConcurrentMutationError");
    expect(engine).toContain("KlyxOrchestrationIdempotencyConflictError");
    expect(fakeStore).toContain('kind: "version_conflict"');
    expect(fakeStore).toContain('kind: "duplicate"');
  });

  it("recovers external unknown state by proving the idempotent effect receipt", () => {
    const engine = read("lib/durable-orchestration-engine.ts");
    const fakes = read("lib/durable-orchestration-fakes.ts");

    expect(engine).toContain("getReceipt(payload.actionId)");
    expect(engine).toContain('kind: "proved_succeeded"');
    expect(engine).toContain("ORCHESTRATION_EFFECT_RECEIPT_FOUND");
    expect(fakes).toContain('"apply_then_unknown"');
  });

  it("runs certification through the actual durable engine and writes PASS/FAIL evidence", () => {
    const certification = read(
      "tests/integration/durable-orchestration-certification.test.ts"
    );
    const launcher = read(
      "scripts/certification/autonomous-klyx-offline-bench.mjs"
    );

    expect(certification).toContain("createFakeDurableOrchestrationRuntime");
    expect(certification).toContain('status: "PASS"');
    expect(certification).toContain('status: "FAIL"');
    expect(certification).toContain("externalNetworkCalls");
    expect(certification).toContain('supabase: "fake-supabase"');
    expect(certification).toContain('stripe: "fake-stripe"');
    expect(launcher).toContain("durable-orchestration-certification.test.ts");
  });
});
