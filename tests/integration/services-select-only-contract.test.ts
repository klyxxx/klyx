import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820003500_klyx_services_select_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const profileManagePath = "app/api/profiles/manage/route.ts";
const adminProposalsPath = "app/api/admin/service-proposals/route.ts";

describe("services catalog select-only contract", () => {
  it("makes the public catalog browser read-only", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_SERVICES_SELECT_ONLY_12B_13H");
    expect(source).toContain(
      "revoke all privileges on table public.services\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant select on table public.services\n  to anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.services\n  to service_role;"
    );
  });

  it("preserves the existing public SELECT RLS policy", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain('CREATE POLICY "klyx_services_select"');
    expect(source).not.toContain('drop policy if exists "klyx_services_select"');
  });

  it("keeps authenticated catalog reads working", () => {
    const profileManage = readFileSync(
      join(process.cwd(), profileManagePath),
      "utf8"
    );

    expect(profileManage).toContain('.from("services")');
    expect(profileManage).toContain('.select("id, name, slug")');
    expect(profileManage).not.toContain('.from("services").insert');
    expect(profileManage).not.toContain('.from("services").update');
  });

  it("keeps service creation behind the authenticated admin boundary", () => {
    const adminRoute = readFileSync(
      join(process.cwd(), adminProposalsPath),
      "utf8"
    );

    expect(adminRoute).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(adminRoute).toContain("await requireKlyxAdmin()");
    expect(adminRoute).toContain('.from("services")');
    expect(adminRoute).toContain(
      '.insert({ name: proposal.proposed_name, slug })'
    );
  });
});
