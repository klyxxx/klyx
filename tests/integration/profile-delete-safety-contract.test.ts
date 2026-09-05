import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function extractBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

const manageRoute = read("app/api/profiles/manage/route.ts");
const accountSwitcher = read("lib/account-switcher.ts");
const canonicalBaseline = read(
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
);
const executionHardening = read(
  "supabase/migrations/20260904213000_klyx_profile_delete_execution_hardening.sql"
);

describe("KLYX multi-profile deletion safety", () => {
  it("keeps profile deletion on the profile-management route and never deletes the parent Auth user", () => {
    const deleteRoute = manageRoute.slice(
      manageRoute.indexOf("export async function DELETE")
    );

    expect(deleteRoute).toContain(
      "const { supabase, user } = await authenticatedUser();"
    );
    expect(deleteRoute).toContain('.eq("owner_user_id", user.id)');
    expect(deleteRoute).toContain("ownedProfiles.length <= 1");
    expect(deleteRoute).toContain("Le dernier profil KLYX ne peut pas être supprimé.");
    expect(deleteRoute).toContain('supabase.rpc("klyx_delete_profile"');
    expect(deleteRoute).toContain("p_profile_id: body.profileId");
    expect(deleteRoute).not.toContain("deleteUser");
    expect(deleteRoute).not.toContain("auth.users");
  });

  it("keeps the client helper scoped to one profile id", () => {
    const deleteProfile = extractBetween(
      accountSwitcher,
      "export async function deleteProfile",
      "\n}"
    );

    expect(deleteProfile).toContain('fetch("/api/profiles/manage"');
    expect(deleteProfile).toContain('method: "DELETE"');
    expect(deleteProfile).toContain("body: JSON.stringify({ profileId })");
    expect(deleteProfile).not.toContain("deleteUser");
  });

  it("authorizes the canonical RPC with auth.uid and deletes only the owned target profile", () => {
    const deleteRpc = extractBetween(
      canonicalBaseline,
      'CREATE OR REPLACE FUNCTION "public"."klyx_delete_profile"',
      'ALTER FUNCTION "public"."klyx_delete_profile"'
    );

    expect(deleteRpc).toContain("owner_id uuid := auth.uid();");
    expect(deleteRpc).toContain("raise exception 'KLYX_NOT_AUTHENTICATED'");
    expect(deleteRpc).toContain("profile.id = p_profile_id");
    expect(deleteRpc).toContain("profile.owner_user_id = owner_id");
    expect(deleteRpc).toContain("raise exception 'KLYX_PROFILE_NOT_OWNED'");
    expect(deleteRpc).toContain("raise exception 'KLYX_LAST_PROFILE'");
    expect(deleteRpc).toContain("where profile.id = p_profile_id");
    expect(deleteRpc).toContain("and profile.owner_user_id = owner_id;");
    expect(deleteRpc).not.toContain("delete from auth.users");
    expect(deleteRpc).not.toContain(
      "delete from public.profiles\n  where owner_user_id = owner_id"
    );
  });

  it("keeps delete-RPC execution unavailable to anonymous callers", () => {
    expect(executionHardening).toContain(
      "revoke all on function public.klyx_delete_profile(uuid) from public;"
    );
    expect(executionHardening).toContain(
      "revoke all on function public.klyx_delete_profile(uuid) from anon;"
    );
    expect(executionHardening).toContain(
      "grant execute on function public.klyx_delete_profile(uuid) to authenticated;"
    );
    expect(executionHardening).toContain(
      "grant execute on function public.klyx_delete_profile(uuid) to service_role;"
    );
    expect(executionHardening).toContain(
      "Sibling client/provider profiles sharing owner_user_id must remain intact."
    );
  });
});
