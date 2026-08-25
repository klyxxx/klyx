import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825190000_klyx_provider_service_capabilities.sql"
  ),
  "utf8"
);

describe("provider service capabilities schema contract", () => {
  it("creates an additive many-to-many capability to provider-offer relation", () => {
    expect(migration).toContain(
      "create table if not exists public.provider_service_capabilities"
    );
    expect(migration).toMatch(
      /capability_id uuid not null\s+references public\.provider_capabilities\(id\) on delete cascade/
    );
    expect(migration).toMatch(
      /user_service_id uuid not null\s+references public\.user_services\(id\) on delete cascade/
    );
    expect(migration).toMatch(
      /profile_id uuid not null\s+references public\.profiles\(id\) on delete cascade/
    );
    expect(migration).toContain(
      "unique (capability_id, user_service_id)"
    );

    // Each capability may support several offers and each offer may use
    // several capabilities: neither side is independently unique.
    expect(migration).not.toMatch(/unique\s*\(\s*capability_id\s*\)/i);
    expect(migration).not.toMatch(/unique\s*\(\s*user_service_id\s*\)/i);
  });

  it("enforces exact active-profile ownership on both parents inside the database", () => {
    expect(migration).toContain(
      "public.klyx_validate_provider_service_capability_link()"
    );
    expect(migration).toContain("capability.profile_id");
    expect(migration).toContain("user_service.user_id");
    expect(migration).toContain(
      "capability_profile_id is distinct from new.profile_id"
    );
    expect(migration).toContain(
      "service_profile_id is distinct from new.profile_id"
    );
    expect(migration).toContain(
      "KLYX_PROVIDER_SERVICE_CAPABILITY_PROFILE_MISMATCH"
    );
    expect(migration).toContain(
      "before insert or update of profile_id, capability_id, user_service_id"
    );
  });

  it("only permits links from provider-confirmed capabilities", () => {
    expect(migration).toContain("capability.status");
    expect(migration).toContain("capability_status <> 'confirmed'");
    expect(migration).toContain(
      "KLYX_PROVIDER_SERVICE_CAPABILITY_REQUIRES_CONFIRMED_CAPABILITY"
    );
  });

  it("keeps direct authenticated writes behind the KLYX server boundary", () => {
    expect(migration).toContain(
      "alter table public.provider_service_capabilities enable row level security"
    );
    expect(migration).toContain(
      'create policy "Providers read own service capability links"'
    );
    expect(migration).toContain(
      "using (public.klyx_owns_profile(profile_id))"
    );
    expect(migration).toMatch(
      /revoke all on table public\.provider_service_capabilities\s+from anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant select on table public\.provider_service_capabilities\s+to authenticated;/
    );
    expect(migration).toMatch(
      /grant all on table public\.provider_service_capabilities\s+to service_role;/
    );
    expect(migration).toMatch(
      /revoke all on function public\.klyx_validate_provider_service_capability_link\(\)\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant execute on function public\.klyx_validate_provider_service_capability_link\(\)\s+to service_role;/
    );
  });

  it("does not couple the relation to publication, qualification, booking or payment state", () => {
    const executableSql = migration
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    expect(executableSql).not.toMatch(/\bbookings?\b/i);
    expect(executableSql).not.toMatch(/\bpayments?\b/i);
    expect(executableSql).not.toMatch(/\bstripe\b/i);
    expect(executableSql).not.toMatch(/skill_qualification_rules/i);
    expect(executableSql).not.toMatch(/provider_skill_verifications/i);
    expect(executableSql).not.toMatch(/service_profiles/i);
    expect(executableSql).not.toMatch(/provider_enabled\s*=/i);
    expect(executableSql).not.toMatch(/active\s*=/i);
  });
});
