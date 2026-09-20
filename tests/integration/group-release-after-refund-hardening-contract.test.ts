import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

const hardeningPath =
  "supabase/migrations/20260919190000_klyx_group_release_after_refund_hardening.sql";

describe("Platform-Held group release-after-refund hardening", () => {
  it("freezes exact claim and historical release amounts", () => {
    const sql = compact(read(hardeningPath));

    expect(sql).toContain(
      "add column if not exists release_claim_amount_cents bigint not null default 0"
    );
    expect(sql).toContain(
      "add column if not exists released_amount_cents bigint not null default 0"
    );
    expect(sql).toContain(
      "release_claim_amount_cents <= provider_amount_cents - refunded_provider_amount_cents"
    );
    expect(sql).toContain("reversed_amount_cents <= released_amount_cents");
  });

  it("claims only the provider entitlement remaining after successful refunds", () => {
    const sql = compact(read(hardeningPath));

    expect(sql).toContain(
      "v_release_amount := v_member.provider_amount_cents - v_member.refunded_provider_amount_cents"
    );
    expect(sql).toContain(
      "sum(m.provider_amount_cents - m.refunded_provider_amount_cents)"
    );
    expect(sql).toContain(
      "then greatest(m.released_amount_cents - m.reversed_amount_cents, 0)"
    );
    expect(sql).toContain("then m.release_claim_amount_cents");
    expect(sql).toContain(
      "v_committed_provider + v_release_amount > v_current_provider_budget"
    );
    expect(sql).toContain(
      "release_claim_amount_cents = v_release_amount"
    );
  });

  it("persists the exact claimed amount as the Stripe Transfer amount", () => {
    const sql = compact(read(hardeningPath));
    const server = read("lib/platform-held-group-settlement-server.ts");

    expect(sql).toContain(
      "released_amount_cents = release_claim_amount_cents"
    );
    expect(server).toContain(
      "amount: Number(claim.provider_amount_cents)"
    );
    expect(server).toContain(
      "expectedAmountCents: Number(claim.provider_amount_cents)"
    );
    expect(server).not.toContain(
      "amount: Number(member.provider_amount_cents)"
    );
  });

  it("allows remaining members to release after a partial refund", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");
    const sql = compact(read(hardeningPath));

    expect(server).toContain('"partially_refunded"');
    expect(sql).toContain(
      "state in ('held', 'release_partial', 'released', 'partially_refunded')"
    );
    expect(sql).toContain(
      "m.provider_amount_cents - m.refunded_provider_amount_cents > 0"
    );
  });

  it("caps both historical gross Transfers and current net Transfers", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");

    expect(server).toContain("let grossTotal = 0");
    expect(server).toContain("let netTotal = 0");
    expect(server).toContain(
      "transfer.amount - Number(transfer.amount_reversed ?? 0)"
    );
    expect(server).toContain("currentProviderEntitlement");
    expect(server).toContain("KLYX_GROUP_HELD_REMOTE_OVERTRANSFER");
    expect(server).toContain("KLYX_GROUP_HELD_REMOTE_NET_OVERTRANSFER");

    const firstCapacity = server.indexOf(
      "existingStripeTransferAmountCents: remote.grossTotal"
    );
    const secondCapacity = server.indexOf(
      "existingStripeTransferAmountCents: remote.netTotal"
    );

    expect(firstCapacity).toBeGreaterThan(-1);
    expect(secondCapacity).toBeGreaterThan(firstCapacity);
  });

  it("never reopens an old ambiguous pre-hardening claim automatically", () => {
    const sql = compact(read(hardeningPath));

    expect(sql).toContain(
      "pre_hardening_refund_release_claim_ambiguous"
    );
    expect(sql).toContain(
      "where state = 'release_claimed' and refunded_provider_amount_cents > 0"
    );
    expect(sql).toContain("set state = 'review_required'");
  });

  it("keeps single-booking settlement tables untouched", () => {
    const sql = read(hardeningPath);
    const server = read("lib/platform-held-group-settlement-server.ts");

    expect(sql).not.toContain("booking_settlements");
    expect(server).not.toContain('from("booking_settlements")');
    expect(server).not.toContain("releasePlatformHeldBookingSettlement");
  });
});
