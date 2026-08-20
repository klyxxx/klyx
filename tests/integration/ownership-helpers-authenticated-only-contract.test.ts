import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820021500_klyx_ownership_helpers_authenticated_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const publicDataPath =
  "supabase/migrations/20260819162500_klyx_public_data_privacy.sql";
const availabilityPath =
  "supabase/migrations/20260819225000_klyx_availability_public_boundary.sql";
const providerBoundaryPath =
  "supabase/migrations/20260819233500_klyx_public_provider_service_boundary.sql";

const helpers = [
  ["klyx_owns_profile", "uuid"],
  ["klyx_owns_booking", "uuid"],
  ["klyx_owns_conversation", "uuid"],
  ["klyx_owns_project", "uuid"],
  ["klyx_owns_user_service", "uuid"],
  ["klyx_shares_booking_with_profile", "uuid"],
  ["klyx_owns_avatar_path", "text"],
] as const;

describe("ownership helpers authenticated-only contract", () => {
  it("splits the remaining mixed provider SELECT policies by role", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "KLYX_OWNERSHIP_HELPERS_AUTHENTICATED_ONLY_12B_13O"
    );
    expect(source).toContain(
      'create policy "klyx_provider_profiles_public_select"'
    );
    expect(source).toContain("to anon\n  using (is_published = true);");
    expect(source).toContain(
      'create policy "klyx_provider_profiles_authenticated_select"'
    );
    expect(source).toContain("or public.klyx_owns_profile(profile_id)");
    expect(source).toContain(
      'create policy "klyx_provider_gallery_public_select"'
    );
    expect(source).toContain(
      'create policy "klyx_provider_gallery_authenticated_select"'
    );
  });

  it("removes direct anonymous execution from every legacy ownership helper", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    for (const [name, args] of helpers) {
      expect(source).toContain(
        `revoke all on function public.${name}(${args})\n  from public, anon;`
      );
      expect(source).toContain(
        `grant execute on function public.${name}(${args})\n  to authenticated, service_role;`
      );
    }
  });

  it("covers the historical anonymous grants", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    for (const [name] of helpers) {
      const grantLine = baseline
        .split("\n")
        .find(
          (line) =>
            line.includes(`GRANT ALL ON FUNCTION \"public\".\"${name}\"`) &&
            line.includes('TO \"anon\";')
        );

      expect(grantLine).toBeTruthy();
    }
  });

  it("keeps anonymous provider visibility published-only", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    const publicProfilePolicy = source.slice(
      source.indexOf('create policy "klyx_provider_profiles_public_select"'),
      source.indexOf('create policy "klyx_provider_profiles_authenticated_select"')
    );
    const publicGalleryPolicy = source.slice(
      source.indexOf('create policy "klyx_provider_gallery_public_select"'),
      source.indexOf('create policy "klyx_provider_gallery_authenticated_select"')
    );

    expect(publicProfilePolicy).toContain("is_published = true");
    expect(publicProfilePolicy).not.toContain("klyx_owns_");
    expect(publicGalleryPolicy).toContain("provider_profile.is_published = true");
    expect(publicGalleryPolicy).not.toContain("klyx_owns_");
  });

  it("keeps the other current public surfaces on dedicated public predicates", () => {
    const publicData = readFileSync(join(process.cwd(), publicDataPath), "utf8");
    const availability = readFileSync(join(process.cwd(), availabilityPath), "utf8");
    const providerBoundary = readFileSync(
      join(process.cwd(), providerBoundaryPath),
      "utf8"
    );

    expect(publicData).toContain('create policy "klyx_profiles_public_select"');
    expect(publicData).toContain("to anon\nusing (\n  account_type = 'provider'");
    expect(availability).toContain(
      "public.klyx_public_availability_service(user_service_id)"
    );
    expect(providerBoundary).toContain(
      "public.klyx_public_provider_service(id)"
    );
    expect(providerBoundary).toContain(
      "public.klyx_public_provider_service(user_service_id)"
    );
  });
});
