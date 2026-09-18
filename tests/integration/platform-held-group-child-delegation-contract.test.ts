import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260918201500_klyx_platform_held_group_child_guard_delegation.sql"
    ),
    "utf8"
  )
  .replace(/\s+/g, " ");

describe("KLYX platform-held group child delegation", () => {
  it("preserves the post-803 NULL-safe standalone guards", () => {
    expect(source).toContain(
      "coalesce(new.payment_mode, '') <> 'platform_held'"
    );
    expect(source).toContain(
      "coalesce(new.payment_status, '') <> 'paid'"
    );
    expect(source).toContain(
      "coalesce(old.payment_status, '') = 'paid'"
    );
    expect(source).toContain("from public.booking_settlements");
  });

  it("does not require one booking_settlements row per group child", () => {
    const occurrences = source.match(/new\.booking_group_id is not null/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps fail-closed standalone settlement errors", () => {
    expect(source).toContain("KLYX_PLATFORM_HELD_SETTLEMENT_MISSING");
    expect(source).toContain("KLYX_PLATFORM_HELD_PAID_SETTLEMENT_NOT_WRITABLE");
  });
});
