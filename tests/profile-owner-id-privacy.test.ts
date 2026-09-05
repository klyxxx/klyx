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

  it("fails closed when a legacy id match is already owned by another auth user", () => {
    const legacyLookup = activeProfile.indexOf(
      '.eq(\n        "id",\n        user.id\n      )'
    );
    const ownershipGuard = activeProfile.indexOf(
      "legacyProfile.owner_user_id !== user.id"
    );
    const legacyRepair = activeProfile.indexOf(
      "!legacyProfile.owner_user_id",
      ownershipGuard
    );
    const legacyReturn = activeProfile.indexOf(
      "normalizeProfile(\n      legacyProfile as ProfileRow",
      ownershipGuard
    );

    expect(activeProfile).toContain(
      "KLYX_LEGACY_PROFILE_OWNER_FAIL_CLOSED_20260905"
    );
    expect(activeProfile).toContain(
      "legacyProfile.owner_user_id &&\n    legacyProfile.owner_user_id !== user.id"
    );
    expect(legacyLookup).toBeGreaterThanOrEqual(0);
    expect(ownershipGuard).toBeGreaterThan(legacyLookup);
    expect(legacyRepair).toBeGreaterThan(ownershipGuard);
    expect(legacyReturn).toBeGreaterThan(legacyRepair);

    const guardBlock = activeProfile.slice(ownershipGuard, legacyRepair);
    expect(guardBlock).toContain("return [];");
  });

  it("only repairs owner_user_id when the legacy owner is absent", () => {
    const repairStart = activeProfile.indexOf("!legacyProfile.owner_user_id");
    const repairEnd = activeProfile.indexOf(
      "return [\n    normalizeProfile(",
      repairStart
    );
    const repairBlock = activeProfile.slice(repairStart, repairEnd);

    expect(repairStart).toBeGreaterThanOrEqual(0);
    expect(repairEnd).toBeGreaterThan(repairStart);
    expect(repairBlock).toContain("owner_user_id:\n            user.id");
    expect(repairBlock).toContain("legacyProfile.owner_user_id =\n      user.id");
  });
});
