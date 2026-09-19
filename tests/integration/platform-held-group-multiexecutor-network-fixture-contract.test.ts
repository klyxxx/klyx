import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "scripts/golden-path-platform-held-group-multiexecutor-network.mjs"
  ),
  "utf8"
);

describe("multi-executor Stripe TEST fixture scheduling", () => {
  it("uses distinct dates for the three proof bookings", () => {
    expect(source).toContain("date: daysAgoDate(1)");
    expect(source).toContain("date: daysAgoDate(2)");
    expect(source).toContain("date: daysAgoDate(3)");
    expect(source).toContain("booking_date: spec.date");
  });

  it("proves a partial refund before release reduces the later Transfer", () => {
    expect(source).toContain("network-pre-release-partial-");
    expect(source).toContain(
      "preReleaseMemberB.provider_amount_cents"
    );
    expect(source).toContain(
      "preReleaseMemberB.refunded_provider_amount_cents"
    );
    expect(source).toContain(
      "Post-refund executor Transfer did not equal remaining provider entitlement."
    );
    expect(source).toContain("released_amount_cents");
    expect(source).toContain(
      "Post-refund net Transfers exceeded current provider entitlement."
    );
    expect(source).toContain("preReleaseRefundNetTransferProved");
  });

  it("does not weaken the provider overlap database guard", () => {
    expect(source).not.toContain("KLYX_PROVIDER_TIME_CONFLICT");
    expect(source).not.toContain("disable trigger");
  });
});
