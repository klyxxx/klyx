import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819205500_klyx_private_request_table_privileges.sql";
const analyzeRoutePath =
  "app/api/requests/analyze/analyze-route-core.ts";
const photoRoutePath =
  "app/api/requests/photo/photo-route-core.ts";
const requestPagePath =
  "app/request/page.tsx";
const photoPagePath =
  "app/request/photo/page.tsx";
const confirmPagePath =
  "app/request/confirm/page.tsx";
const confirmMultiPagePath =
  "app/request/confirm-multi/page.tsx";

const privateRequestTables = [
  "service_requests",
  "photo_service_requests",
] as const;

describe("private request table privilege hardening contract", () => {
  it("keeps private text/photo request records service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_PRIVATE_REQUEST_TABLE_PRIVILEGES_12B_12S"
    );

    for (const table of privateRequestTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }

    expect(source).toContain(
      'drop policy if exists "klyx_service_requests_all"'
    );
    expect(source).toContain(
      'drop policy if exists "Clients read own photo requests"'
    );
  });

  it("keeps request database writes behind authenticated server APIs", () => {
    const analyzeRoute = readFileSync(
      join(process.cwd(), analyzeRoutePath),
      "utf8"
    );
    const photoRoute = readFileSync(
      join(process.cwd(), photoRoutePath),
      "utf8"
    );

    for (const source of [analyzeRoute, photoRoute]) {
      expect(source).toContain(
        'import { supabaseAdmin } from "@/lib/supabase-admin";'
      );
      expect(source).toContain(
        'requireAccountType(profile, "client")'
      );
    }

    expect(analyzeRoute).toContain(
      '.from("service_requests")'
    );
    expect(photoRoute).toContain(
      '.from("photo_service_requests")'
    );
  });

  it("keeps request pages off the raw private tables while preserving photo Storage upload", () => {
    const requestPage = readFileSync(
      join(process.cwd(), requestPagePath),
      "utf8"
    );
    const photoPage = readFileSync(
      join(process.cwd(), photoPagePath),
      "utf8"
    );
    const confirmPage = readFileSync(
      join(process.cwd(), confirmPagePath),
      "utf8"
    );
    const confirmMultiPage = readFileSync(
      join(process.cwd(), confirmMultiPagePath),
      "utf8"
    );

    expect(requestPage).toContain(
      '"/api/requests/analyze"'
    );
    expect(photoPage).toContain(
      '"/api/requests/photo"'
    );
    expect(photoPage).toContain(
      '.from("client-service-photos")'
    );

    for (const source of [
      requestPage,
      photoPage,
      confirmPage,
      confirmMultiPage,
    ]) {
      expect(source).not.toContain(
        '.from("service_requests")'
      );
      expect(source).not.toContain(
        '.from("photo_service_requests")'
      );
    }
  });
});
