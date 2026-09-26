import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"), "utf8");

describe("provider certification runtime safety", () => {
  it("keeps outage simulation isolated from real provider shutdowns", () => {
    expect(workflow).toContain("Provider outages use deterministic tests/fault injection only");
    expect(workflow).not.toContain("stripe trigger");
  });
});
