import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819225000_klyx_availability_public_boundary.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const providerPagePath = "app/providers/[id]/page.tsx";
const bookingPagePath = "app/providers/[id]/book/page.tsx";
const studioCorePath = "app/api/provider/studio/studio-route-core.ts";

describe("availability public boundary contract", () => {
  it("keeps browser availability read-only and service_role fully privileged", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_AVAILABILITY_PUBLIC_BOUNDARY_12B_13A");
    expect(source).toContain(
      "revoke all privileges on table public.availability_slots\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant select on table public.availability_slots\n  to anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.availability_slots\n  to service_role;"
    );
  });

  it("removes browser mutation policies while preserving a filtered SELECT policy", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    for (const policy of [
      "klyx_availability_delete",
      "klyx_availability_insert",
      "klyx_availability_update",
      "klyx_availability_select",
    ]) {
      expect(baseline).toContain(`CREATE POLICY \"${policy}\"`);
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
    }

    expect(baseline).toContain(
      'CREATE POLICY "klyx_availability_select" ON "public"."availability_slots" FOR SELECT TO "authenticated", "anon" USING (true);'
    );
    expect(source).toContain('create policy "klyx_availability_select"');
    expect(source).toContain(
      "public.klyx_public_availability_service(user_service_id)"
    );
  });

  it("exposes schedules only for approved, enabled and available provider services", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "create or replace function public.klyx_public_availability_service("
    );
    expect(source).toContain("security definer");
    expect(source).toContain("set search_path = public, pg_temp");
    expect(source).toContain("from public.user_services as user_service");
    expect(source).toContain("join public.service_profiles as service_profile");
    expect(source).toContain(
      "join public.provider_skill_verifications as verification"
    );
    expect(source).toContain("verification.status = 'approved'");
    expect(source).toContain("user_service.active = true");
    expect(source).toContain("user_service.provider_enabled = true");
    expect(source).toContain("service_profile.available = true");
    expect(source).toContain(
      "revoke all privileges on function public.klyx_public_availability_service(uuid)\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant execute on function public.klyx_public_availability_service(uuid)\n  to anon, authenticated, service_role;"
    );
  });

  it("preserves the two public browser reads required by provider discovery and booking", () => {
    const providerPage = readFileSync(
      join(process.cwd(), providerPagePath),
      "utf8"
    );
    const bookingPage = readFileSync(
      join(process.cwd(), bookingPagePath),
      "utf8"
    );

    expect(providerPage).toContain('.from("availability_slots")');
    expect(providerPage).toContain('.eq("is_active", true)');
    expect(bookingPage).toContain('.from("availability_slots")');
    expect(bookingPage).toContain('.eq("is_active", true)');
  });

  it("keeps availability mutations behind Provider Studio supabaseAdmin", () => {
    const studioCore = readFileSync(
      join(process.cwd(), studioCorePath),
      "utf8"
    );

    expect(studioCore).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(studioCore).toContain('.from("availability_slots")');
    expect(studioCore).toContain(".delete()");
    expect(studioCore).toContain(".insert(");
  });
});
