import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const core = readFileSync(
  join(
    process.cwd(),
    "app/api/provider/capabilities/capabilities-route-core.ts"
  ),
  "utf8"
);

const route = readFileSync(
  join(process.cwd(), "app/api/provider/capabilities/route.ts"),
  "utf8"
);

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825183000_klyx_provider_capabilities_server_only.sql"
  ),
  "utf8"
);

describe("provider capabilities server API contract", () => {
  it("anchors every product mutation to the authenticated active provider profile", () => {
    expect(core).toContain("getAuthenticatedProfile(request)");
    expect(core).toContain('requireAccountType(profile, "provider")');
    expect(core).toContain("profile_id: profile.id");
    expect(core).toContain('.eq("profile_id", profile.id)');
    expect(core).toContain('.eq("id", id)');
  });

  it("keeps server-managed capability fields outside client control", () => {
    for (const field of [
      '"profile_id"',
      '"source"',
      '"canonical_service_id"',
      '"normalized_label"',
      '"origin_text"',
    ]) {
      expect(core).toContain(field);
    }

    expect(core).toContain("hasServerManagedField(rawBody)");
    expect(core).toContain("KLYX_PROVIDER_CAPABILITY_MANAGED_FIELD");
    expect(core).toContain("normalizeKlyxProviderCapabilityLabel(label)");
    expect(core).toContain('source: "provider"');
    expect(core).toContain('status: "confirmed"');
    expect(core).toContain("canonical_service_id: null");
    expect(core).toContain("origin_text: null");
  });

  it("treats manual confirmation as self-declaration, supports archival and prevents duplicates", () => {
    expect(core).toContain('rawBody.status !== "confirmed"');
    expect(core).toContain('rawBody.status !== "archived"');
    expect(core).toContain("KLYX_PROVIDER_CAPABILITY_DUPLICATE");
    expect(core).toContain('.neq("status", "archived")');
    expect(core).toContain('error?.code === "23505"');
  });

  it("does not expose destructive deletion and sanitizes unexpected server failures", () => {
    expect(route).toContain('type Method = "GET" | "POST" | "PATCH"');
    expect(route).not.toMatch(/export async function DELETE/);
    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain("KLYX_PROVIDER_CAPABILITIES_REQUEST_FAILED");
  });

  it("makes authenticated writes server-only while preserving owner reads", () => {
    expect(migration).toContain(
      'drop policy if exists "Providers create own capabilities"'
    );
    expect(migration).toContain(
      'drop policy if exists "Providers update own capabilities"'
    );
    expect(migration).toContain(
      'drop policy if exists "Providers delete own capabilities"'
    );
    expect(migration).toMatch(
      /revoke insert, update, delete\s+on table public\.provider_capabilities\s+from authenticated;/
    );
    expect(migration).toMatch(
      /grant select\s+on table public\.provider_capabilities\s+to authenticated;/
    );
    expect(migration).toMatch(
      /grant all\s+on table public\.provider_capabilities\s+to service_role;/
    );
  });
});
