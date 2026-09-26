import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"), "utf8");

describe("provider certification exact source boundary", () => {
  it("checks out exact source after SHA validation", () => {
    expect(workflow.indexOf("Verify immutable certification SHA")).toBeLessThan(workflow.indexOf("Checkout exact source"));
  });
});
