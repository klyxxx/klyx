import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819201000_klyx_provider_document_table_privileges.sql";
const studioRoutePath =
  "app/api/provider/studio/studio-route-core.ts";
const studioComponentPath =
  "app/components/ProviderStudio.tsx";

describe("provider document table privilege hardening contract", () => {
  it("keeps private provider document metadata service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_PROVIDER_DOCUMENT_TABLE_PRIVILEGES_12B_12P"
    );
    expect(source).toContain(
      "revoke all privileges on table public.provider_documents\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.provider_documents\n  to service_role;"
    );
  });

  it("keeps Provider Studio document access behind the server API", () => {
    const route = readFileSync(
      join(process.cwd(), studioRoutePath),
      "utf8"
    );
    const component = readFileSync(
      join(process.cwd(), studioComponentPath),
      "utf8"
    );

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain(
      '.from("provider_documents")'
    );
    expect(component).toContain(
      'fetch("/api/provider/studio"'
    );
    expect(component).not.toContain(
      '.from("provider_documents")'
    );
  });
});
