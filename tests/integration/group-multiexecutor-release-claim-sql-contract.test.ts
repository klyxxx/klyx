import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260918211000_klyx_platform_held_group_multiexecutor_test.sql"
  ),
  "utf8"
);

describe("multi-executor release claim SQL qualification", () => {
  it("qualifies member accounting columns that collide with RETURNS TABLE names", () => {
    expect(source).toContain(
      "select coalesce(sum(m.provider_amount_cents), 0)"
    );
    expect(source).toContain(
      "from public.platform_held_group_settlement_members m"
    );
    expect(source).toContain(
      "where m.group_settlement_id = v_parent.id"
    );
    expect(source).toContain(
      "m.stripe_transfer_id is not null"
    );
    expect(source).toContain(
      "m.state = 'release_claimed'"
    );
  });

  it("does not keep the ambiguous unqualified aggregate in the claim", () => {
    const start = source.indexOf(
      "create or replace function public.klyx_claim_platform_held_group_member_release"
    );
    const end = source.indexOf(
      "\ncreate or replace function public.",
      start + 20
    );
    const claim = source.slice(start, end > start ? end : undefined);

    expect(claim).not.toContain("sum(provider_amount_cents)");
  });
});
