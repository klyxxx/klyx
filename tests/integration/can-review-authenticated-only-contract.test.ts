import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820014500_klyx_can_review_authenticated_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const reviewRoutePath = "app/api/reviews/route.ts";

describe("can-review RPC authenticated-only contract", () => {
  it("removes anonymous execution while preserving authenticated policy use", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_CAN_REVIEW_AUTHENTICATED_ONLY_12B_13M");
    expect(source).toContain(
      "revoke all on function public.klyx_can_review(uuid, uuid, uuid)\n  from public, anon;"
    );
    expect(source).toContain(
      "grant execute on function public.klyx_can_review(uuid, uuid, uuid)\n  to authenticated, service_role;"
    );
  });

  it("covers the historical SECURITY DEFINER anonymous grant", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'CREATE OR REPLACE FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") RETURNS boolean'
    );
    expect(baseline).toContain(
      'LANGUAGE "sql" STABLE SECURITY DEFINER'
    );
    expect(baseline).toContain(
      'GRANT ALL ON FUNCTION "public"."klyx_can_review"("booking_id" "uuid", "author_id" "uuid", "target_id" "uuid") TO "anon";'
    );
  });

  it("keeps the helper limited to authenticated review write policies", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'CREATE POLICY "klyx_reviews_insert" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("public"."klyx_owns_profile"("author_id") AND "public"."klyx_can_review"("booking_id", "author_id", "target_id")));'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_reviews_update" ON "public"."reviews" FOR UPDATE TO "authenticated"'
    );
  });

  it("keeps the active review API on explicit server-side booking checks", () => {
    const route = readFileSync(join(process.cwd(), reviewRoutePath), "utf8");

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain("async function bookingForReview(");
    expect(route).toContain("booking.parent_id !== clientProfileId");
    expect(route).toContain('booking.status !== "completed"');
    expect(route).not.toContain('.rpc("klyx_can_review"');
  });
});
