import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819230500_klyx_provider_gallery_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const publicProviderPagePath = "app/providers/[id]/page.tsx";
const studioComponentPath = "app/components/ProviderStudio.tsx";
const studioCorePath = "app/api/provider/studio/studio-route-core.ts";

describe("provider gallery privilege contract", () => {
  it("exposes only public gallery metadata to browser roles", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PROVIDER_GALLERY_PRIVILEGES_12B_13B");
    expect(source).toContain(
      "revoke all privileges on table public.provider_gallery\n  from public, anon, authenticated;"
    );
    expect(source).toContain("id,\n  profile_id,\n  public_url,\n  caption,\n  position");
    expect(source).toContain(
      ") on table public.provider_gallery\n  to anon, authenticated;"
    );
    expect(source).not.toContain("storage_path,\n  public_url");
    expect(source).toContain(
      "grant all privileges on table public.provider_gallery\n  to service_role;"
    );
  });

  it("removes historical browser mutation policies and preserves SELECT RLS", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    for (const policy of [
      "klyx_provider_gallery_delete",
      "klyx_provider_gallery_insert",
      "klyx_provider_gallery_update",
    ]) {
      expect(baseline).toContain(`CREATE POLICY \"${policy}\"`);
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
    }

    expect(baseline).toContain('CREATE POLICY "klyx_provider_gallery_select"');
    expect(source).not.toContain('drop policy if exists "klyx_provider_gallery_select"');
  });

  it("keeps the public profile query inside the minimized column grant", () => {
    const page = readFileSync(
      join(process.cwd(), publicProviderPagePath),
      "utf8"
    );

    expect(page).toContain('.from("provider_gallery")');
    expect(page).toContain('.select("id, public_url, caption")');
    expect(page).toContain('.eq("profile_id", providerId)');
    expect(page).toContain('.order("position", { ascending: true })');
    expect(page).not.toContain("storage_path");
  });

  it("keeps gallery mutation behind Provider Studio and supabaseAdmin", () => {
    const component = readFileSync(
      join(process.cwd(), studioComponentPath),
      "utf8"
    );
    const core = readFileSync(join(process.cwd(), studioCorePath), "utf8");

    expect(component).toContain('fetch("/api/provider/studio"');
    expect(component).toContain('kind: "gallery" | "document"');
    expect(component).not.toContain('.from("provider_gallery")');

    expect(core).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(core).toContain('.from("provider_gallery")');
    expect(core).toContain("storage_path");
    expect(core).toContain(".insert({");
    expect(core).toContain(".delete()");
  });
});
