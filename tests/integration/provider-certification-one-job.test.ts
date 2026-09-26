import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"), "utf8");

describe("provider certification single failure domain", () => {
  it("uses one fail-closed certification job", () => {
    expect(workflow).toContain("providers-and-mobile:");
    expect(workflow).not.toContain("continue-on-error");
  });
});
