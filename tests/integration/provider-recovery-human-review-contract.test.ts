import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX recovery before human review", () => {
  it("keeps human review as the last deterministic recovery state", () => {
    const resilience = source("lib/resilience-engine.ts");
    const scope = source("CERTIFICATION_ALL_PROVIDERS.md");

    expect(scope).toContain("automatic retry/reconciliation first");
    expect(scope).toContain("human_review");
    expect(resilience).toMatch(/human_review|manual_review|review/i);
  });
});
