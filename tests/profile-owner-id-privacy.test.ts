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
    expect(activeProfile).toContain("owner_user_id");
    expect(activeProfile).toContain("user.id");
  });

  it("fails closed when a legacy id match is already owned by another auth user", () => {
    const legacyLookup = activeProfile.search(
      /\.eq\(\s*"id",\s*user\.id\s*\)/
    );
    const ownershipGuard = activeProfile.indexOf(
      "legacyProfile.owner_user_id !== user.id"
    );
    const legacyRepair = activeProfile.indexOf(
      "!legacyProfile.owner_user_id",
      ownershipGuard
    );
    const legacyReturn = activeProfile.indexOf(
      "normalizeOwnedProfiles(user.id, [profileToReturn])",
      ownershipGuard
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
      "return normalizeOwnedProfiles(user.id, [profileToReturn]);",
      repairStart
    );
    const repairBlock = activeProfile.slice(repairStart, repairEnd);

    expect(repairStart).toBeGreaterThanOrEqual(0);
    expect(repairEnd).toBeGreaterThan(repairStart);
    expect(repairBlock).toMatch(/owner_user_id:\s*user\.id/);
    expect(repairBlock).toMatch(/\.is\(\s*"owner_user_id",\s*null\s*\)/);
    expect(repairBlock).not.toContain("legacyProfile.owner_user_id =");
  });

  it("makes the legacy owner repair compare-and-set and fails closed on a race", () => {
    const repairStart = activeProfile.indexOf("!legacyProfile.owner_user_id");
    const ownerPreconditionMatch = /\.is\(\s*"owner_user_id",\s*null\s*\)/g;
    ownerPreconditionMatch.lastIndex = repairStart;
    const ownerPrecondition = ownerPreconditionMatch.exec(activeProfile)?.index ?? -1;
    const repairedRowRead = activeProfile.indexOf(".maybeSingle();", ownerPrecondition);
    const raceGuard = activeProfile.indexOf("if (!repairedProfile)", repairedRowRead);
    const repairedAssignment = activeProfile.indexOf(
      "profileToReturn = repairedProfile as ProfileRow;",
      raceGuard
    );

    expect(repairStart).toBeGreaterThanOrEqual(0);
    expect(ownerPrecondition).toBeGreaterThan(repairStart);
    expect(repairedRowRead).toBeGreaterThan(ownerPrecondition);
    expect(raceGuard).toBeGreaterThan(repairedRowRead);
    expect(repairedAssignment).toBeGreaterThan(raceGuard);

    const raceGuardBlock = activeProfile.slice(raceGuard, repairedAssignment);
    expect(raceGuardBlock).toContain("return [];");
  });

  it("fails closed on canonical account ownership mismatch", () => {
    expect(activeProfile).toContain('.from("accounts")');
    expect(activeProfile).toMatch(/\.eq\(\s*"auth_user_id",\s*ownerUserId\s*\)/);
    expect(activeProfile).toContain("KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH");
    expect(activeProfile).toContain(
      "profile.account_id !== null && profile.account_id !== account.id"
    );
  });
});
