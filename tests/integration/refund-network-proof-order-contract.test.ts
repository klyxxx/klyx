import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs
  .readFileSync(
    path.join(process.cwd(), ".github/workflows/klyx-stripe-network-test.yml"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX Stripe network proof ordering", () => {
  it("keeps checkout creation before paid/refund verification and cleanup after both", () => {
    const checkout = "node scripts/golden-path-stripe-network-checkout.mjs";
    const refund = "node scripts/golden-path-stripe-network-refund.mjs";
    const upload = "Upload Stripe network proof";

    expect(workflow).toContain(checkout);
    expect(workflow).toContain(refund);
    expect(workflow.indexOf(checkout)).toBeLessThan(workflow.indexOf(refund));
    expect(workflow.indexOf(refund)).toBeLessThan(workflow.indexOf(upload));
  });
});
