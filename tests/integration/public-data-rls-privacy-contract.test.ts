import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819162500_klyx_public_data_privacy.sql";

describe("public data RLS privacy contract", () => {
  it("keeps private provider profile columns out of anonymous SELECT", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain("KLYX_PUBLIC_DATA_PRIVACY_12B_12C");
    expect(source).toContain(
      "revoke select on table public.profiles from anon;"
    );
    expect(source).toContain("grant select (");
    expect(source).toContain("phone_number");
    expect(source).toContain("stripe_account_id");
    expect(source).not.toContain("phone_number,\n  phone_verified_at");
  });

  it("requires publication for anonymous provider directory data", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain('"klyx_profiles_public_select"');
    expect(source).toContain('"klyx_user_services_public_select"');
    expect(source).toContain('"klyx_service_profiles_public_select"');
    expect(source).toContain('"klyx_availability_public_select"');
    expect(source.match(/provider_profile\.is_published = true/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(4);
    expect(source).toContain("provider_enabled = true");
    expect(source).toContain("is_active = true");
  });

  it("removes raw reviews from the anonymous database surface", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "revoke select on table public.reviews from anon;"
    );
    expect(source).toContain('"klyx_reviews_authenticated_select"');
    expect(source).toContain("public.klyx_owns_booking(booking_id)");
  });
});
