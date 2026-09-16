import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const migrationPath =
  "supabase/migrations/20260819202500_klyx_provider_assistant_draft_privileges.sql";
const assistantRoutePath = "app/api/provider/assistant/assistant-route-core.ts";

describe("provider assistant draft privilege hardening contract", () => {
  it("keeps private provider assistant drafts service-role only", () => {
    const source = read(migrationPath);

    expect(source).toContain("KLYX_PROVIDER_ASSISTANT_DRAFT_PRIVILEGES_12B_12Q");
    expect(source).toContain(
      "revoke all privileges on table public.provider_assistant_drafts\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.provider_assistant_drafts\n  to service_role;"
    );
  });

  it("keeps legacy draft access server-only while the visible UI is unified", () => {
    const route = read(assistantRoutePath);
    const legacyPage = read("app/provider/assistant/page.tsx");
    const apiAuth = read("lib/api-auth.ts");

    expect(route).toContain('import { supabaseAdmin } from "@/lib/supabase-admin";');
    expect(route).toContain('.from("provider_assistant_drafts")');
    expect(route).toContain('requireAccountType(profile, "provider")');
    expect(apiAuth).toContain('if (pathname.startsWith("/api/provider/"))');
    expect(apiAuth).toContain('accountType: profile.canOfferServices ? "provider" : "client"');
    expect(legacyPage).toContain('redirect("/assistant")');
    expect(legacyPage).not.toContain('.from("provider_assistant_drafts")');
  });
});
