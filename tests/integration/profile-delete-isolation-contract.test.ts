import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const manageRoute = readFileSync(
  join(process.cwd(), "app/api/profiles/manage/route.ts"),
  "utf8"
);

const canonicalSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
  ),
  "utf8"
);

function deleteProfileRpcBody() {
  const startMarker =
    'CREATE OR REPLACE FUNCTION "public"."klyx_delete_profile"("p_profile_id" "uuid") RETURNS "void"';
  const start = canonicalSql.indexOf(startMarker);

  expect(start).toBeGreaterThanOrEqual(0);

  const bodyStart = canonicalSql.indexOf("AS $$", start);
  const bodyEnd = canonicalSql.indexOf("$$;", bodyStart + 5);

  expect(bodyStart).toBeGreaterThan(start);
  expect(bodyEnd).toBeGreaterThan(bodyStart);

  return canonicalSql.slice(bodyStart, bodyEnd + 3);
}

describe("profile deletion isolation contract", () => {
  it("keeps deletion scoped to the requested owned profile", () => {
    const rpcBody = deleteProfileRpcBody();

    expect(rpcBody).toContain("owner_id uuid := auth.uid()");
    expect(rpcBody).toContain("where user_service.user_id = p_profile_id");
    expect(rpcBody).toContain("where profile.id = p_profile_id");
    expect(rpcBody).toContain("and profile.owner_user_id = owner_id");

    expect(rpcBody).not.toMatch(/delete\s+from\s+auth\.users/i);
    expect(rpcBody).not.toMatch(/delete\s+from\s+public\.profiles[\s\S]*?where\s+profile\.owner_user_id\s*=\s*owner_id\s*;/i);
  });

  it("preserves a sibling profile through the profile management API", () => {
    expect(manageRoute).toContain('.eq("owner_user_id", user.id)');
    expect(manageRoute).toContain("profile.id === body.profileId");
    expect(manageRoute).toContain("ownedProfiles.length <= 1");
    expect(manageRoute).toContain('supabase.rpc("klyx_delete_profile", {');
    expect(manageRoute).toContain("p_profile_id: body.profileId");
    expect(manageRoute).toContain(
      "ownedProfiles.find((profile) => profile.id !== body.profileId)?.id"
    );

    expect(manageRoute).not.toContain('supabaseAdmin.auth.admin.deleteUser(user.id)');
  });
});
