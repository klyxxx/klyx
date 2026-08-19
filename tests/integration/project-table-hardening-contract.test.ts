import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819222000_klyx_project_table_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const projectPagePath = "app/projects/new/page.tsx";
const projectApiPath = "app/api/projects/plan/route.ts";

describe("project table hardening contract", () => {
  it("makes project persistence service-role only", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PROJECT_TABLE_HARDENING_12B_12Y");
    expect(source).toContain(
      "revoke all privileges on table public.projects\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "revoke all privileges on table public.project_services\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.projects\n  to service_role;"
    );
    expect(source).toContain(
      "grant all privileges on table public.project_services\n  to service_role;"
    );
  });

  it("removes the historical authenticated ALL-command policies", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain('CREATE POLICY "klyx_projects_all"');
    expect(baseline).toContain('CREATE POLICY "klyx_project_services_all"');
    expect(source).toContain('drop policy if exists "klyx_projects_all"');
    expect(source).toContain('drop policy if exists "klyx_project_services_all"');
  });

  it("keeps browser project creation behind the authenticated API", () => {
    const page = readFileSync(join(process.cwd(), projectPagePath), "utf8");

    expect(page).toContain('supabase.auth.getSession()');
    expect(page).toContain('"/api/projects/plan"');
    expect(page).not.toContain('.from("projects")');
    expect(page).not.toContain('.from("project_services")');
  });

  it("persists both tables only through supabaseAdmin on the server", () => {
    const route = readFileSync(join(process.cwd(), projectApiPath), "utf8");

    expect(route).toContain('import { supabaseAdmin } from "@/lib/supabase-admin";');
    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain('requireAccountType(profile, "client")');
    expect(route).toContain('.from("projects")');
    expect(route).toContain('.from("project_services")');
    expect(route).toContain("await supabaseAdmin");
  });
});
