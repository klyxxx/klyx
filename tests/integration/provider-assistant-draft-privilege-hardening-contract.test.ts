import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819202500_klyx_provider_assistant_draft_privileges.sql";
const assistantRoutePath =
  "app/api/provider/assistant/assistant-route-core.ts";
const assistantPagePath =
  "app/provider/assistant/page.tsx";

describe("provider assistant draft privilege hardening contract", () => {
  it("keeps private provider assistant drafts service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_PROVIDER_ASSISTANT_DRAFT_PRIVILEGES_12B_12Q"
    );
    expect(source).toContain(
      "revoke all privileges on table public.provider_assistant_drafts\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.provider_assistant_drafts\n  to service_role;"
    );
  });

  it("keeps provider assistant draft access behind the server API", () => {
    const route = readFileSync(
      join(process.cwd(), assistantRoutePath),
      "utf8"
    );
    const page = readFileSync(
      join(process.cwd(), assistantPagePath),
      "utf8"
    );

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain(
      '.from("provider_assistant_drafts")'
    );
    expect(route).toContain(
      'requireAccountType(profile, "provider")'
    );
    expect(page).toContain(
      '"/api/provider/assistant"'
    );
    expect(page).not.toContain(
      '.from("provider_assistant_drafts")'
    );
  });
});
