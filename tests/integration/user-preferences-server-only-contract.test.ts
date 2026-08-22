import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820024500_klyx_user_preferences_server_only.sql";
const priorHardeningPath =
  "supabase/migrations/20260819185500_klyx_client_memory_table_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const memoryProfileRoutePath = "app/api/memory/profile/route.ts";
const memoryPreferencesRoutePath = "app/api/memory/preferences/route.ts";
const requestAnalyzeRoutePath =
  "app/api/requests/analyze/analyze-route-core.ts";
const sharedMemoryPath = "lib/client-memory-context.ts";
const memoryPagePath = "app/memory/page.tsx";
const requestPagePath = "app/request/page.tsx";

describe("user preferences server boundary contract", () => {
  it("keeps the existing server-only table privilege boundary", () => {
    const source = readFileSync(
      join(process.cwd(), priorHardeningPath),
      "utf8"
    );

    expect(source).toContain(
      "revoke all privileges on table public.user_preferences\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.user_preferences\n  to service_role;"
    );
  });

  it("removes the dormant direct browser RLS policy", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "KLYX_USER_PREFERENCES_POLICY_LOCKDOWN_12B_13Q"
    );
    expect(source).toContain(
      'drop policy if exists "klyx_user_preferences_all"\n  on public.user_preferences;'
    );
  });

  it("covers the historical broad grants and browser policy", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."user_preferences" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_user_preferences_all" ON "public"."user_preferences" TO "authenticated"'
    );
  });

  it("keeps every active preferences database flow behind supabaseAdmin", () => {
    for (const path of [
      memoryProfileRoutePath,
      memoryPreferencesRoutePath,
      sharedMemoryPath,
    ]) {
      const route = readFileSync(join(process.cwd(), path), "utf8");

      expect(route).toContain(
        'import { supabaseAdmin } from "@/lib/supabase-admin";'
      );
      expect(route).toContain('.from("user_preferences")');
      expect(route).not.toContain('import { supabase } from "@/lib/supabase";');
    }

    const requestAnalysis = readFileSync(
      join(process.cwd(), requestAnalyzeRoutePath),
      "utf8"
    );

    expect(requestAnalysis).toContain(
      'from "@/lib/client-memory-context"'
    );
    expect(requestAnalysis).not.toContain('.from("user_preferences")');
    expect(requestAnalysis).not.toContain(
      'import { supabase } from "@/lib/supabase";'
    );
  });

  it("keeps browser memory and request UIs behind authenticated APIs", () => {
    const memoryPage = readFileSync(join(process.cwd(), memoryPagePath), "utf8");
    const requestPage = readFileSync(join(process.cwd(), requestPagePath), "utf8");

    expect(memoryPage).toContain('"/api/memory/profile"');
    expect(memoryPage).not.toContain('.from("user_preferences")');

    expect(requestPage).toContain('"/api/requests/analyze"');
    expect(requestPage).not.toContain('.from("user_preferences")');
  });
});
