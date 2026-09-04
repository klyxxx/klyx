import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveKlyxAccountDeletePlan } from "@/lib/account-delete-scope";

const deleteRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/account/delete/route.ts"),
  "utf8"
);
const settingsPage = fs.readFileSync(
  path.join(process.cwd(), "app/settings/page.tsx"),
  "utf8"
);

describe("KLYX account deletion isolation", () => {
  it("deletes only the requested profile when another role remains", () => {
    expect(
      resolveKlyxAccountDeletePlan(
        [{ id: "client-profile" }, { id: "provider-profile" }],
        "provider-profile"
      )
    ).toEqual({
      scope: "profile",
      targetProfileId: "provider-profile",
      replacementProfileId: "client-profile",
    });
  });

  it("deletes the authentication account only for the last profile", () => {
    expect(
      resolveKlyxAccountDeletePlan([{ id: "client-profile" }], "client-profile")
    ).toEqual({
      scope: "account",
      targetProfileId: "client-profile",
      replacementProfileId: null,
    });
  });

  it("rejects a profile that does not belong to the authenticated owner", () => {
    expect(
      resolveKlyxAccountDeletePlan(
        [{ id: "client-profile" }, { id: "provider-profile" }],
        "other-user-profile"
      )
    ).toBeNull();
  });

  it("keeps profile deletion ahead of the irreversible auth deletion", () => {
    const profileScopeIndex = deleteRoute.indexOf(
      'if (deletePlan.scope === "profile" && deletePlan.targetProfileId)'
    );
    const authDeleteIndex = deleteRoute.indexOf(
      "supabaseAdmin.auth.admin.deleteUser(user.id)"
    );

    expect(profileScopeIndex).toBeGreaterThanOrEqual(0);
    expect(authDeleteIndex).toBeGreaterThan(profileScopeIndex);
    expect(deleteRoute).toContain(
      'deletePlan.scope === "profile" && deletePlan.targetProfileId\n        ? [deletePlan.targetProfileId]'
    );
    expect(deleteRoute).toContain('deletedScope: "profile" as const');
  });

  it("sends the active profile id and preserves the remaining sign-in", () => {
    expect(settingsPage).toContain("profileId: activeProfileId");
    expect(settingsPage).toContain('result.deletedScope === "profile"');
    expect(settingsPage).toContain('router.replace("/accounts")');

    const profileRedirectIndex = settingsPage.indexOf(
      'router.replace("/accounts")'
    );
    const localStorageClearIndex = settingsPage.indexOf("localStorage.clear()");

    expect(profileRedirectIndex).toBeGreaterThanOrEqual(0);
    expect(localStorageClearIndex).toBeGreaterThan(profileRedirectIndex);
  });
});
