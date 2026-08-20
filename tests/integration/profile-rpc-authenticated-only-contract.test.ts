import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820011500_klyx_profile_rpc_authenticated_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const manageRoutePath = "app/api/profiles/manage/route.ts";

describe("profile RPC authenticated-only contract", () => {
  it("removes anonymous execution while preserving authenticated callers", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PROFILE_RPC_AUTHENTICATED_ONLY_12B_13K");
    expect(source).toContain(
      "revoke all on function public.klyx_create_profile(text, text, text, text, uuid)\n  from public, anon;"
    );
    expect(source).toContain(
      "grant execute on function public.klyx_create_profile(text, text, text, text, uuid)\n  to authenticated, service_role;"
    );
    expect(source).toContain(
      "revoke all on function public.klyx_delete_profile(uuid)\n  from public, anon;"
    );
    expect(source).toContain(
      "grant execute on function public.klyx_delete_profile(uuid)\n  to authenticated, service_role;"
    );
  });

  it("covers the historical anon grants and auth.uid fail-closed checks", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'GRANT ALL ON FUNCTION "public"."klyx_create_profile"("p_first_name" "text", "p_last_name" "text", "p_city" "text", "p_account_type" "text", "p_service_id" "uuid") TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") TO "anon";'
    );
    expect(baseline).toContain("owner_id uuid := auth.uid();");
    expect(baseline.match(/raise exception 'KLYX_NOT_AUTHENTICATED';/g)?.length)
      .toBeGreaterThanOrEqual(2);
  });

  it("keeps the API on the authenticated user-scoped client", () => {
    const route = readFileSync(join(process.cwd(), manageRoutePath), "utf8");

    expect(route).toContain("await supabase.auth.getUser()");
    expect(route).toContain('supabase.rpc(\n      "klyx_create_profile"');
    expect(route).toContain('supabase.rpc("klyx_delete_profile"');
    expect(route).not.toContain('supabaseAdmin.rpc("klyx_create_profile"');
    expect(route).not.toContain('supabaseAdmin.rpc("klyx_delete_profile"');
  });
});
