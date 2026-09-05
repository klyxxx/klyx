import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/sumsub/webhook/route.ts"
  ),
  "utf8"
);

describe("Sumsub webhook hardening", () => {
  it("retries duplicate events that were not fully processed", () => {
    const duplicateIndex = route.indexOf(
      "const duplicateEvent ="
    );
    const processedLookupIndex = route.indexOf(
      '.select("processed")',
      duplicateIndex
    );
    const processedGuardIndex = route.indexOf(
      "if (existingEvent?.processed)",
      processedLookupIndex
    );
    const processingIndex = route.indexOf(
      "if (payload.testMode === true)",
      processedGuardIndex
    );

    expect(duplicateIndex).toBeGreaterThanOrEqual(0);
    expect(processedLookupIndex).toBeGreaterThan(
      duplicateIndex
    );
    expect(processedGuardIndex).toBeGreaterThan(
      processedLookupIndex
    );
    expect(processingIndex).toBeGreaterThan(
      processedGuardIndex
    );
  });

  it("never applies manually triggered Sumsub test callbacks", () => {
    const testModeIndex = route.indexOf(
      "if (payload.testMode === true)"
    );
    const profileMutationIndex = route.indexOf(
      "const profileId =",
      testModeIndex
    );

    expect(testModeIndex).toBeGreaterThanOrEqual(0);
    expect(route.slice(testModeIndex, profileMutationIndex)).toContain(
      'ignored: "test_mode"'
    );
    expect(profileMutationIndex).toBeGreaterThan(
      testModeIndex
    );
  });

  it("blocks sandbox decisions in production", () => {
    expect(route).toContain(
      "function isProductionRuntime(): boolean"
    );

    const sandboxGuardIndex = route.indexOf(
      "payload.sandboxMode === true &&"
    );
    const profileMutationIndex = route.indexOf(
      "const profileId =",
      sandboxGuardIndex
    );

    expect(sandboxGuardIndex).toBeGreaterThanOrEqual(0);
    expect(route.slice(sandboxGuardIndex, profileMutationIndex)).toContain(
      "isProductionRuntime()"
    );
    expect(route.slice(sandboxGuardIndex, profileMutationIndex)).toContain(
      '"sandbox_in_production"'
    );
  });

  it("does not erase a final review result when a later event omits it", () => {
    expect(route).toContain(
      "payload.reviewResult\n        ?.reviewAnswer !== undefined"
    );
    expect(route).toContain(
      "payload.reviewResult\n        ?.reviewRejectType !== undefined"
    );
    expect(route).toContain(
      "payload.reviewResult\n        ?.moderationComment !== undefined"
    );
  });
});
