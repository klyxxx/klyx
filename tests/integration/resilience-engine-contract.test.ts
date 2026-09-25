import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const engine = fs.readFileSync(path.join(root, "lib/resilience-engine.ts"), "utf8");
const memory = fs.readFileSync(
  path.join(root, "lib/resilience-memory-adapter.ts"),
  "utf8"
);

describe("KLYX resilience engine architecture contract", () => {
  it("is independent from Supabase, Stripe and real financial mutation", () => {
    const source = `${engine}\n${memory}`.toLowerCase();
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("from \"stripe\"");
    expect(source).not.toContain("stripe.transfers");
    expect(source).not.toContain("stripe.refunds");
    expect(source).not.toContain("paymentintents.create");
  });

  it("contains the required resilience primitives", () => {
    expect(engine).toContain("idempotencyKey");
    expect(engine).toContain("computeKlyxExponentialBackoffMs");
    expect(engine).toContain("dead_lettered");
    expect(engine).toContain("human_review");
    expect(engine).toContain("recoverExpiredClaims");
    expect(engine).toContain("recoverMissingWebhook");
    expect(engine).toContain("unknown_external_state");
    expect(engine).toContain("poison_job");
    expect(engine).toContain("KlyxResilienceConcurrentMutationError");
  });

  it("keeps durable storage behind an adapter boundary", () => {
    expect(engine).toContain("export interface KlyxResilienceStore");
    expect(memory).toContain("implements KlyxResilienceStore");
    expect(memory).toContain("ManualKlyxResilienceClock");
  });
});
