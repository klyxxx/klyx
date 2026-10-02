import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"), "utf8");

describe("KLYX provider outage isolation", () => {
  it("requires deterministic fault injection instead of destructive provider outages", () => {
    expect(scope).toContain("Provider outages are injected through deterministic tests/mocks");
    expect(scope).toContain("Ambiguous side effects are never blindly replayed");
  });
});
