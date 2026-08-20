import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820005000_klyx_stores_server_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const createStorePagePath = "app/create-store/page.tsx";

describe("legacy stores server-only contract", () => {
  it("removes browser privileges and keeps trusted server access", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_STORES_SERVER_ONLY_12B_13J");
    expect(source).toContain(
      "revoke all privileges on table public.stores\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.stores\n  to service_role;"
    );
  });

  it("closes the historical direct-browser store policy", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain('CREATE POLICY "klyx_stores_all"');
    expect(source).toContain('drop policy if exists "klyx_stores_all"');

    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."stores" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."stores" TO "authenticated";'
    );
  });

  it("keeps the retired create-store entry point away from the stores table", () => {
    const page = readFileSync(join(process.cwd(), createStorePagePath), "utf8");

    expect(page).not.toContain('.from("stores")');
    expect(page).not.toContain("supabaseAdmin");
    expect(page).toContain('redirect("/provider")');
    expect(page).toContain('redirect("/accounts")');
  });
});
