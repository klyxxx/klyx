import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260918200000_klyx_platform_held_group_ledger_guard.sql"
    ),
    "utf8"
  )
  .replace(/\s+/g, " ");

describe("KLYX platform-held single + group ledger guard", () => {
  it("preserves the certified single settlement authority", () => {
    expect(source).toContain("from public.booking_settlements");
    expect(source).toContain(
      "KLYX_PLATFORM_HELD_LEDGER_SETTLEMENT_MISSING"
    );
    expect(source).toContain(
      "new.gross_amount_cents := v_single.gross_amount_cents"
    );
  });

  it("uses one group settlement as authority for child ledger economics", () => {
    expect(source).toContain("from public.booking_group_settlements");
    expect(source).toContain(
      "KLYX_PLATFORM_HELD_GROUP_LEDGER_SETTLEMENT_MISSING"
    );
    expect(source).toContain(
      "v_group.platform_fee_cents + v_group.provider_amount_cents <> v_group.gross_amount_cents"
    );
    expect(source).toContain(
      "KLYX_PLATFORM_HELD_GROUP_LEDGER_GROSS_MISMATCH"
    );
  });

  it("assigns deterministic rounding remainder to the last child", () => {
    expect(source).toContain("select max(b.group_position)");
    expect(source).toContain(
      "v_group.platform_fee_cents - v_prior_fee::integer"
    );
    expect(source).toContain(
      "new.provider_amount_cents := v_booking.amount_total - v_fee"
    );
  });
});
