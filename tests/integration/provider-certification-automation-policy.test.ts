import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX recovery automation policy", () => {
  it("requires automatic recovery before human intervention", () => {
    expect(scope).toContain("automatic retry/reconciliation first");
    expect(scope).toMatch(
      /`?human_review`? only when deterministic recovery cannot prove the external state/
    );
  });
});
