import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820013000_klyx_photo_service_requests_server_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const pagePath = "app/request/photo/page.tsx";
const routeCorePath = "app/api/requests/photo/photo-route-core.ts";

describe("photo service request server boundary contract", () => {
  it("removes all browser table privileges", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "KLYX_PHOTO_SERVICE_REQUESTS_SERVER_ONLY_12B_13L"
    );
    expect(source).toContain(
      "revoke all privileges on table public.photo_service_requests\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.photo_service_requests\n  to service_role;"
    );
  });

  it("drops the historical direct-read policy", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'CREATE POLICY "Clients read own photo requests"'
    );
    expect(source).toContain(
      'drop policy if exists "Clients read own photo requests"'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."photo_service_requests" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."photo_service_requests" TO "authenticated";'
    );
  });

  it("keeps SQL metadata behind the authenticated API route", () => {
    const page = readFileSync(join(process.cwd(), pagePath), "utf8");

    expect(page).toContain('fetch(\n        "/api/requests/photo"');
    expect(page).not.toContain('.from("photo_service_requests")');
    expect(page).not.toContain('channel("photo_service_requests"');
    expect(page).not.toContain("postgres_changes");
  });

  it("keeps browser access limited to the photo Storage bucket", () => {
    const page = readFileSync(join(process.cwd(), pagePath), "utf8");

    expect(page).toContain('.from("client-service-photos")');
    expect(page).toContain(".upload(uploadedPath, file");
    expect(page).toContain(".remove([uploadedPath])");
  });

  it("uses supabaseAdmin for all photo request table operations", () => {
    const route = readFileSync(join(process.cwd(), routeCorePath), "utf8");

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain('requireAccountType(profile, "client")');
    expect(
      route.match(/supabaseAdmin\s*\n\s*\.from\("photo_service_requests"\)/g)
        ?.length
    ).toBeGreaterThanOrEqual(3);
    expect(route).not.toContain('supabase\n      .from("photo_service_requests")');
  });
});
