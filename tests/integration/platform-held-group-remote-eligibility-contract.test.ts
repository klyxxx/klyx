import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "lib/platform-held-group-settlement-server.ts"),
  "utf8"
);
const stripeTruth = fs.readFileSync(
  path.join(root, "lib/stripe-settlement-recipient-truth.ts"),
  "utf8"
);

describe("Platform-Held group remote Stripe eligibility", () => {
  it("keeps canonical destination resolution before claim but remote Stripe truth after the atomic claim", () => {
    expect(stripeTruth).toContain("stripe.v2.core.accounts.retrieve");
    expect(stripeTruth).toContain(
      'include: ["configuration.recipient", "identity", "requirements"]'
    );
    expect(stripeTruth).toContain('stripe_transfers?.status === "active"');
    expect(stripeTruth).toContain("stripe.accounts.retrieve");

    const canonicalDestination = source.indexOf(
      "getProviderStripeDestination("
    );
    const canonicalProvider = source.indexOf(
      "member.provider_profile_id",
      canonicalDestination
    );
    const claim = source.indexOf(
      '"klyx_claim_platform_held_group_member_release"'
    );
    const remoteTruth = source.indexOf(
      "await readStripeSettlementRecipientTruth(",
      claim
    );
    const create = source.indexOf("await stripe.transfers.create(", remoteTruth);

    expect(canonicalDestination).toBeGreaterThan(-1);
    expect(canonicalProvider).toBeGreaterThan(canonicalDestination);
    expect(claim).toBeGreaterThan(canonicalProvider);
    expect(remoteTruth).toBeGreaterThan(claim);
    expect(create).toBeGreaterThan(remoteTruth);

    expect(
      source.indexOf("await readStripeSettlementRecipientTruth(", 0)
    ).toBe(remoteTruth);
  });

  it("isolates post-claim remote ineligibility to the affected settlement member", () => {
    expect(source).toContain('"stripe_recipient_not_ready_after_claim"');
    expect(source).toContain("await failReleaseClaim(");
    expect(source).toContain("await markMemberReview(");
    expect(source).not.toContain(
      'markParentReview(\n        parent.id,\n        "stripe_recipient_not_ready_after_claim"'
    );
  });
});
