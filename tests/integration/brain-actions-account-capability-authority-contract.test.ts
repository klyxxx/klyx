import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("KLYX Brain actions account capability authority", () => {
  it("uses canonical account capabilities as authority and legacy profile type only as a storage adapter", () => {
    const actions = compact(read("lib/brain-actions.ts"));

    expect(actions).toContain('profile.legacyAccountType === "client"');
    expect(actions).toContain("profile.canRequestServices");
    expect(actions).toContain("profile.canOfferServices");
    expect(actions).toContain("if (!hasAccountCapabilityForStorageProfile(profile)) { return []; }");
    expect(actions).not.toContain('profile.accountType === "client"');
  });

  it("keeps unified mission management capable of reading both historical storage perspectives through the gated registry", () => {
    const route = compact(read("app/api/brain/converse/route.ts"));

    expect(route).toContain("params.profiles.map((profile) => getBrainActions(profile))");
    expect(route).toContain("uniqueActions(actionGroups.flat())");
  });
});
