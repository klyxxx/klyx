import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819234500_klyx_service_proposals_server_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const providerRoutePath = "app/api/provider/service-proposals/route.ts";
const adminRoutePath = "app/api/admin/service-proposals/route.ts";
const providerPagePath = "app/provider/services/new/page.tsx";

describe("service proposal server boundary contract", () => {
  it("removes all browser table privileges", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_SERVICE_PROPOSALS_SERVER_ONLY_12B_13I");
    expect(source).toContain(
      "revoke all privileges on table public.service_proposals\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.service_proposals\n  to service_role;"
    );
  });

  it("drops the historical provider PostgREST policies", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    for (const policy of [
      "Providers can create own service proposals",
      "Providers can read own service proposals",
    ]) {
      expect(baseline).toContain(`CREATE POLICY \"${policy}\"`);
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
    }

    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."service_proposals" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."service_proposals" TO "authenticated";'
    );
  });

  it("keeps the provider UI behind its API route", () => {
    const page = readFileSync(join(process.cwd(), providerPagePath), "utf8");

    expect(page).toContain('fetch("/api/provider/service-proposals"');
    expect(page).not.toContain('.from("service_proposals")');
  });

  it("uses supabaseAdmin for provider proposal reads and writes", () => {
    const route = readFileSync(join(process.cwd(), providerRoutePath), "utf8");

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain("const profile = await getActiveProfile();");
    expect(route).toContain('profile.accountType !== "provider"');
    expect(route.match(/supabaseAdmin\s*\n\s*\.from\("service_proposals"\)/g)?.length)
      .toBeGreaterThanOrEqual(3);
    expect(route).not.toContain('supabase\n    .from("service_proposals")');
  });

  it("keeps admin review on the same trusted client", () => {
    const route = readFileSync(join(process.cwd(), adminRoutePath), "utf8");

    expect(route).toContain("await requireKlyxAdmin();");
    expect(route).toContain(
      'supabaseAdmin\n      .from("service_proposals")'.replace("\\n", "\n")
    );
    expect(route).toContain(".update({");
  });
});
