import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const stateMachine = read("lib/brain/orchestrator/state-machine.ts");
const migration = read(
  "supabase/migrations/20260923214600_klyx_orchestrator_earn_completion.sql"
);
const runtimeProof = read("scripts/mission19-earn-lifecycle.mjs");
const goldenPath = read(".github/workflows/klyx-golden-path.yml");

describe("Mission 19B GAGNER completion certification", () => {
  it("requires completion between mission and settlement in TypeScript", () => {
    expect(stateMachine).toContain('"mission",\n  "completion",\n  "settlement"');
    expect(stateMachine).toContain('mission: ["completion"]');
    expect(stateMachine).toContain('completion: ["settlement"]');
    expect(stateMachine).not.toContain('mission: ["settlement"]');
  });

  it("requires the same completion boundary in the canonical database RPC", () => {
    expect(migration).toContain(
      "when 'mission' then p_to_step = 'completion'"
    );
    expect(migration).toContain(
      "when 'completion' then p_to_step = 'settlement'"
    );
    expect(migration).not.toContain(
      "when 'mission' then p_to_step = 'settlement'"
    );
  });

  it("proves the full persisted GAGNER lifecycle at runtime", () => {
    expect(runtimeProof).toContain('p_mode: "earn"');
    expect(runtimeProof).toContain('p_to_step: "settlement"');
    expect(runtimeProof).toContain(
      'skippedCompletionError?.message?.includes("KLYX_WORKFLOW_TRANSITION_INVALID")'
    );
    expect(runtimeProof).toContain('"mission",\n    "completion",\n    "settlement"');
    expect(runtimeProof).toContain('mission19EarnLifecyclePassed: true');
  });

  it("makes the GAGNER runtime proof mandatory in Golden Path", () => {
    expect(goldenPath).toContain(
      "Verify Mission 19 GAGNER lifecycle and completion boundary"
    );
    expect(goldenPath).toContain(
      "node scripts/mission19-earn-lifecycle.mjs"
    );
  });
});
