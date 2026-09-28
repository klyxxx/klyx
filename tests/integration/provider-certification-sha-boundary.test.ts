import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"),
  "utf8"
);

describe("provider certification exact source boundary", () => {
  it("validates an optional requested SHA, checks out the resolved SHA and verifies HEAD", () => {
    const validate = workflow.indexOf("Validate requested certification SHA");
    const checkout = workflow.indexOf("Checkout exact certification SHA");
    const verify = workflow.indexOf("Verify exact checkout");

    expect(validate).toBeGreaterThanOrEqual(0);
    expect(checkout).toBeGreaterThan(validate);
    expect(verify).toBeGreaterThan(checkout);
  });
});
