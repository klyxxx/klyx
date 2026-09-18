import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260918201000_klyx_platform_held_group_child_booking_guards.sql"
    ),
    "utf8"
  )
  .replace(/\s+/g, " ");

describe("KLYX platform-held booking guards for single and group children", () => {
  it("retains single booking settlement and PaymentIntent authority", () => {
    expect(source).toContain("from public.booking_settlements");
    expect(source).toContain("KLYX_PLATFORM_HELD_PAYMENT_INTENT_REQUIRED");
    expect(source).toContain(
      "new.amount_total := v_single.gross_amount_cents"
    );
  });

  it("derives grouped child economics from the parent group settlement", () => {
    expect(source).toContain("from public.booking_group_settlements");
    expect(source).toContain(
      "KLYX_PLATFORM_HELD_GROUP_CHILD_SETTLEMENT_MISSING"
    );
    expect(source).toContain(
      "v_group.platform_fee_cents - v_prior_fee::integer"
    );
    expect(source).toContain("new.provider_amount := new.amount_total - v_fee");
  });

  it("does not try to transition a single settlement for grouped children", () => {
    expect(source).toContain("if new.booking_group_id is not null then return new");
    expect(source).toContain(
      "Parent booking_group_settlements owns the grouped payment state"
    );
  });
});
