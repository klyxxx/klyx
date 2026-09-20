import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/platform-held-group-settlement-server.ts"),
  "utf8"
);

describe("Platform-Held group remote Stripe eligibility", () => {
  it("rechecks the remote recipient both before claim and immediately before Transfer", () => {
    expect(source).toContain("stripe.v2.core.accounts.retrieve");
    expect(source).toContain('include: ["configuration.recipient", "identity", "requirements"]');
    expect(source).toContain('stripe_transfers?.status === "active"');

    const first = source.indexOf(
      "await stripeRecipientStillReady(stripe, member.stripe_account_id)"
    );
    const claim = source.indexOf(
      '"klyx_claim_platform_held_group_member_release"',
      first
    );
    const second = source.indexOf(
      "await stripeRecipientStillReady(stripe, member.stripe_account_id)",
      first + 1
    );
    const create = source.indexOf("await stripe.transfers.create(", second);

    expect(first).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(claim);
    expect(create).toBeGreaterThan(second);
  });

  it("isolates remote ineligibility to the affected settlement member", () => {
    expect(source).toContain('"stripe_recipient_not_ready"');
    expect(source).toContain('"stripe_recipient_not_ready_after_claim"');
    expect(source).toContain("await markMemberReview(");
    expect(source).not.toContain(
      'markParentReview(\n        parent.id,\n        "stripe_recipient_not_ready"'
    );
  });
});
