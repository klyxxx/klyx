import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819220500_klyx_favorite_table_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const favoriteButtonPath =
  "app/components/FavoriteButton.tsx";
const favoritesPagePath =
  "app/favorites/page.tsx";

describe("favorite table privilege hardening contract", () => {
  it("removes broad browser grants and keeps only required authenticated verbs", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_FAVORITE_TABLE_PRIVILEGES_12B_12X"
    );
    expect(source).toContain(
      "revoke all privileges on table public.favorites\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant select on table public.favorites\n  to authenticated;"
    );
    expect(source).toContain(
      "grant insert (user_id, service_profile_id) on table public.favorites\n  to authenticated;"
    );
    expect(source).toContain(
      "grant delete on table public.favorites\n  to authenticated;"
    );
    expect(source).not.toContain(
      "grant update on table public.favorites"
    );
    expect(source).not.toContain(
      "grant all privileges on table public.favorites\n  to authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.favorites\n  to service_role;"
    );
  });

  it("replaces the ALL-command RLS policy with explicit owner policies", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      'drop policy if exists "klyx_favorites_all"'
    );
    expect(source).toContain(
      'create policy "klyx_favorites_select"'
    );
    expect(source).toContain(
      'create policy "klyx_favorites_insert"'
    );
    expect(source).toContain(
      'create policy "klyx_favorites_delete"'
    );
    expect(source).toContain(
      "public.klyx_owns_profile(user_id)"
    );
    expect(source).toContain(
      "public.klyx_profile_has_type(user_id, 'client'::text)"
    );
  });

  it("locks the historical broad exposure being narrowed", () => {
    const baseline = readFileSync(
      join(process.cwd(), baselinePath),
      "utf8"
    );

    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."favorites" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."favorites" TO "authenticated";'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_favorites_all"'
    );
  });

  it("preserves the current direct favorite UI contract without UPDATE", () => {
    const button = readFileSync(
      join(process.cwd(), favoriteButtonPath),
      "utf8"
    );
    const page = readFileSync(
      join(process.cwd(), favoritesPagePath),
      "utf8"
    );

    expect(button).toContain('.from("favorites")');
    expect(button).toContain(".select(\"id\")");
    expect(button).toContain(".delete()");
    expect(button).toContain(".insert({");
    expect(button).not.toContain(".update(");

    expect(page).toContain('.from("favorites")');
    expect(page).toContain(
      '.select("id, service_profile_id")'
    );
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete()");
  });
});
