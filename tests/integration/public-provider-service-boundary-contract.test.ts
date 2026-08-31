import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819233500_klyx_public_provider_service_boundary.sql";
const availabilityMigrationPath =
  "supabase/migrations/20260819225000_klyx_availability_public_boundary.sql";
const privacyMigrationPath =
  "supabase/migrations/20260819162500_klyx_public_data_privacy.sql";
const babysittersPagePath = "app/babysitters/page.tsx";
const babysitterBookingPath = "app/babysitters/[id]/page.tsx";

describe("public provider service boundary contract", () => {
  it("requires every publication and skill gate in one SECURITY DEFINER helper", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PUBLIC_PROVIDER_SERVICE_BOUNDARY_12B_13D");
    expect(source).toContain(
      "create or replace function public.klyx_public_provider_service("
    );
    expect(source).toContain("security definer");
    expect(source).toContain("join public.provider_profiles as provider_profile");
    expect(source).toContain(
      "join public.provider_skill_verifications as verification"
    );
    expect(source).toContain("verification.status = 'approved'");
    expect(source).toContain("user_service.active = true");
    expect(source).toContain("user_service.provider_enabled = true");
    expect(source).toContain("service_profile.available = true");
    expect(source).toContain("provider_profile.is_published = true");
    expect(source).toContain(
      "grant execute on function public.klyx_public_provider_service(uuid)\n  to anon, authenticated, service_role;"
    );
  });

  it("closes the 12B.13A publication gap for direct availability reads", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const previous = readFileSync(
      join(process.cwd(), availabilityMigrationPath),
      "utf8"
    );

    expect(previous).toContain(
      "create or replace function public.klyx_public_availability_service("
    );
    expect(previous).toContain("verification.status = 'approved'");
    expect(previous).not.toContain(
      "join public.provider_profiles as provider_profile"
    );

    expect(source).toContain(
      "create or replace function public.klyx_public_availability_service("
    );
    expect(source).toContain(
      "select public.klyx_public_provider_service(p_user_service_id);"
    );
  });

  it("uses the canonical helper for public user-service and service-profile RLS", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const privacy = readFileSync(join(process.cwd(), privacyMigrationPath), "utf8");

    for (const policy of [
      "klyx_user_services_authenticated_select",
      "klyx_user_services_public_select",
      "klyx_service_profiles_authenticated_select",
      "klyx_service_profiles_public_select",
    ]) {
      expect(privacy).toContain(`create policy \"${policy}\"`);
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
      expect(source).toContain(`create policy \"${policy}\"`);
    }

    expect(source).toContain("public.klyx_public_provider_service(id)");
    expect(source).toContain(
      "public.klyx_public_provider_service(user_service_id)"
    );
    expect(source).toContain("public.klyx_owns_profile(user_id)");
    expect(source).toContain("public.klyx_owns_user_service(user_service_id)");
  });

  it("keeps the legacy babysitter booking reads protected while the listing delegates to recommendations", () => {
    const listing = readFileSync(join(process.cwd(), babysittersPagePath), "utf8");
    const booking = readFileSync(
      join(process.cwd(), babysitterBookingPath),
      "utf8"
    );

    expect(listing).toContain("KLYX_BABYSITTERS_COMPATIBILITY_ROUTE");
    expect(listing).toContain('params.set("service", "babysitting")');
    expect(listing).toContain('redirect(`/recommendations?${params.toString()}`)');
    expect(listing).not.toContain('.from("user_services")');
    expect(listing).not.toContain('.from("service_profiles")');
    expect(listing).not.toContain('.from("availability_slots")');

    expect(booking).toContain('.from("user_services")');
    expect(booking).toContain('.from("service_profiles")');
    expect(booking).toContain('.from("availability_slots")');
    expect(booking).not.toContain('.from("provider_skill_verifications")');
  });
});
