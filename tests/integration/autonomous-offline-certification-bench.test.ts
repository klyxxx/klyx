import { describe, expect, it } from "vitest";

import {
  renderMarkdownReport,
  runAutonomousCertificationBench,
} from "../../scripts/certification/autonomous-klyx-offline-bench.mjs";

const REQUIRED_COVERAGE = [
  "browser_closed_reopened",
  "conversation_deleted",
  "llm_model_changed",
  "webhook_delayed",
  "worker_crash",
  "retry",
  "double_click",
  "action_replayed",
  "price_modified_during_workflow",
  "beneficiary_became_ineligible",
  "payment_simulated_succeeded",
  "payment_simulated_failed",
  "refund_replacement",
  "resume_after_incident",
] as const;

describe("KLYX autonomous offline certification bench", () => {
  it("certifies every required scenario with fake adapters and no network access", () => {
    const report = runAutonomousCertificationBench() as any;

    expect(report.summary.status).toBe("PASS");
    expect(report.summary.failed).toBe(0);
    expect(report.summary.total).toBeGreaterThanOrEqual(15);
    expect(report.liveAccess).toBe(false);
    expect(report.deterministic).toBe(true);
    expect(report.adapters).toEqual({
      supabase: "fake-supabase",
      stripe: "fake-stripe",
      clock: "deterministic",
      ids: "deterministic",
      faultInjection: true,
    });

    for (const requirement of REQUIRED_COVERAGE) {
      expect(report.coverage[requirement]?.status, requirement).toBe("PASS");
    }

    expect(
      report.results.every(
        (scenario: any) =>
          scenario.status === "PASS" &&
          scenario.evidence?.externalNetworkCalls === 0
      )
    ).toBe(true);
  });

  it("is reproducible byte-for-byte at the report object level", () => {
    const first = runAutonomousCertificationBench();
    const second = runAutonomousCertificationBench();

    expect(second).toEqual(first);
    expect(renderMarkdownReport(second)).toBe(renderMarkdownReport(first));
  });

  it("covers continuity on both DEMANDER and GAGNER", () => {
    const report = runAutonomousCertificationBench() as any;

    for (const requirement of [
      "browser_closed_reopened",
      "conversation_deleted",
      "llm_model_changed",
      "worker_crash",
      "retry",
      "double_click",
      "action_replayed",
      "price_modified_during_workflow",
      "resume_after_incident",
    ]) {
      expect(report.coverage[requirement]?.modes, requirement).toEqual([
        "DEMANDER",
        "GAGNER",
      ]);
    }
  });
});
