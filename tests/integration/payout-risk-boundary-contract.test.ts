import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("payout risk control boundary", () => {
  it("does not falsely certify a KLYX payout gate while Stripe still owns the payout side effect", () => {
    const financialStatus = source(
      "app/api/stripe/connect/financial-status/route.ts"
    );
    const createAccount = source(
      "app/api/stripe/connect/create-account/route.ts"
    );

    expect(financialStatus).toContain("stripe.payouts.list(");
    expect(financialStatus).not.toContain("stripe.payouts.create(");
    expect(createAccount).toContain('type: "express"');
    expect(createAccount).not.toContain('interval: "manual"');
  });
});
