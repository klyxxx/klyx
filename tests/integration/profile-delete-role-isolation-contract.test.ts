import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("profile deletion role-isolation contract", () => {
  it("keeps profile deletion scoped to one profile instead of the auth account", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/profiles/manage/route.ts"),
      "utf8"
    );

    expect(route).toContain('.eq("owner_user_id", user.id)');
    expect(route).toContain('supabase.rpc("klyx_delete_profile"');
    expect(route).toContain("p_profile_id: body.profileId");
    expect(route).toContain("ownedProfiles.length <= 1");

    // Profile deletion must never be implemented as auth-user deletion.
    expect(route).not.toContain("auth.admin.deleteUser");
    expect(route).not.toContain("deleteUser(user.id)");
  });

  it("does not expose the SECURITY DEFINER deletion RPC to anonymous callers", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260904213000_klyx_profile_delete_execution_hardening.sql"
      ),
      "utf8"
    );

    expect(migration).toContain(
      "revoke all on function public.klyx_delete_profile(uuid) from anon;"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_delete_profile(uuid) to authenticated;"
    );
    expect(migration).toContain(
      "Deletes exactly one authenticated user-owned KLYX profile"
    );
  });
});
