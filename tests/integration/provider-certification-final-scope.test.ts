import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"), "utf8");

describe("provider certification final scope", () => {
  it("keeps all requested engines inside one certification mission", () => {
    expect(scope).toContain("DEMANDER");
    expect(scope).toContain("GAGNER");
    expect(scope).toContain("Transverse");
    expect(scope).toContain("Failure injection");
  });
});
