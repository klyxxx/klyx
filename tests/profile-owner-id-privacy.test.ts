import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260827133000_klyx_profile_owner_id_privacy.sql"
  ),
  "utf8"
);

const activeProfile = fs.readFileSync(
  path.join(process.cwd(), "lib/active-profile.ts"),
  "utf8"
);

describe("profile owner id privacy", () => {
  it("revokes authenticated direct reads of owner_user_id", () => {
    expect(migration).toMatch(
      /revoke\s+select\s*\(owner_user_id\)\s+on\s+table\s+public\.profiles\s+from\s+authenticated/i
    );
  });

  it("keeps ownership resolution on the server-side admin client", () => {
    expect(activeProfile).toContain('import "server-only"');
    expect(activeProfile).toContain("supabaseAdmin");
    expect(activeProfile).toContain('"owner_user_id"');
    expect(activeProfile).toContain("user.id");
  });
});
