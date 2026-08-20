import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820023000_klyx_reviews_server_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const privacyPath =
  "supabase/migrations/20260819162500_klyx_public_data_privacy.sql";
const reviewRoutePath = "app/api/reviews/route.ts";
const groupReviewRoutePath = "app/api/group-reviews/route.ts";
const publicReviewRoutePath = "app/api/providers/[id]/reviews/route.ts";
const reviewPagePath = "app/reviews/[bookingId]/page.tsx";
const groupReviewPagePath = "app/reviews/group/[groupId]/page.tsx";
const publicReviewsPath = "app/providers/[id]/PublicReviews.tsx";

describe("review table server boundary contract", () => {
  it("removes every browser table privilege", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_REVIEWS_SERVER_ONLY_12B_13P");
    expect(source).toContain(
      "revoke all privileges on table public.reviews\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.reviews\n  to service_role;"
    );
  });

  it("removes obsolete direct review RLS policies", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    for (const policy of [
      "klyx_reviews_select",
      "klyx_reviews_authenticated_select",
      "klyx_reviews_insert",
      "klyx_reviews_update",
    ]) {
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
    }
  });

  it("covers the historical broad grants and partial privacy hardening", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");
    const privacy = readFileSync(join(process.cwd(), privacyPath), "utf8");

    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."reviews" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."reviews" TO "authenticated";'
    );
    expect(privacy).toContain("revoke select on table public.reviews from anon;");
    expect(privacy).toContain(
      'create policy "klyx_reviews_authenticated_select"'
    );
  });

  it("keeps simple and grouped review reads and writes on supabaseAdmin", () => {
    for (const path of [reviewRoutePath, groupReviewRoutePath]) {
      const route = readFileSync(join(process.cwd(), path), "utf8");

      expect(route).toContain(
        'import { supabaseAdmin } from "@/lib/supabase-admin";'
      );
      expect(route).toContain('.from("reviews")');
      expect(route).not.toContain('import { supabase } from "@/lib/supabase";');
    }
  });

  it("keeps public review projection behind the provider reviews API", () => {
    const route = readFileSync(join(process.cwd(), publicReviewRoutePath), "utf8");
    const component = readFileSync(join(process.cwd(), publicReviewsPath), "utf8");

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain('.from("reviews")');
    expect(route).toContain('is_published", true');
    expect(component).toContain(`/api/providers/${providerId}/reviews`);
    expect(component).not.toContain('.from("reviews")');
  });

  it("keeps both client review pages behind API routes", () => {
    const reviewPage = readFileSync(join(process.cwd(), reviewPagePath), "utf8");
    const groupPage = readFileSync(join(process.cwd(), groupReviewPagePath), "utf8");

    expect(reviewPage).toContain('/api/reviews?bookingId=');
    expect(reviewPage).toContain('fetch("/api/reviews"');
    expect(reviewPage).not.toContain('.from("reviews")');

    expect(groupPage).toContain('/api/group-reviews?groupId=');
    expect(groupPage).toContain('fetch("/api/group-reviews"');
    expect(groupPage).not.toContain('.from("reviews")');
  });
});
