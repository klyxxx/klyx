import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260906000500_klyx_handle_new_user_search_path.sql"
  ),
  "utf8"
);

const normalized = migration.toLowerCase();

describe("handle_new_user search_path migration", () => {
  it("pins only the existing trigger function search_path", () => {
    expect(normalized).toContain("alter function public.handle_new_user()");
    expect(normalized).toContain("set search_path = '';");

    expect(normalized).not.toContain("create or replace function");
    expect(normalized).not.toContain("create policy");
    expect(normalized).not.toContain("alter policy");
    expect(normalized).not.toContain("klyx_claim_booking_payment");
    expect(normalized).not.toContain("klyx_claim_booking_group_payment");
    expect(normalized).not.toContain("stripe");
  });
});
