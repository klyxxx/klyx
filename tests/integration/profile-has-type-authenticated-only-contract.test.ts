import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820020000_klyx_profile_has_type_authenticated_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";

describe("profile type helper authenticated-only contract", () => {
  it("removes anonymous execution while preserving authenticated RLS use", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "KLYX_PROFILE_HAS_TYPE_AUTHENTICATED_ONLY_12B_13N"
    );
    expect(source).toContain(
      "revoke all on function public.klyx_profile_has_type(uuid, text)\n  from public, anon;"
    );
    expect(source).toContain(
      "grant execute on function public.klyx_profile_has_type(uuid, text)\n  to authenticated, service_role;"
    );
  });

  it("covers the historical SECURITY DEFINER anonymous grant and oracle body", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'CREATE OR REPLACE FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") RETURNS boolean'
    );
    expect(baseline).toContain('LANGUAGE "sql" STABLE SECURITY DEFINER');
    expect(baseline).toContain("profile.account_type = expected_type");
    expect(baseline).toContain(
      'GRANT ALL ON FUNCTION "public"."klyx_profile_has_type"("profile_id" "uuid", "expected_type" "text") TO "anon";'
    );
  });

  it("keeps known helper-dependent write policies authenticated-only", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'CREATE POLICY "klyx_bookings_insert" ON "public"."bookings" FOR INSERT TO "authenticated"'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_provider_documents_insert" ON "public"."provider_documents" FOR INSERT TO "authenticated"'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_user_services_insert" ON "public"."user_services" FOR INSERT TO "authenticated"'
    );
  });
});
