import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("KLYX account capability residual guards", () => {
  it("routes the compatibility dashboard from canonical capability projections into the single assistant home", () => {
    const accountHome = read("lib/account-home.ts");
    const dashboard = read("app/dashboard/page.tsx");

    expect(accountHome).toContain("canRequestServices");
    expect(accountHome).toContain("canOfferServices");
    expect(accountHome).toContain("input.canRequestServices || input.canOfferServices");
    expect(accountHome).toContain('return "/assistant";');
    expect(accountHome).not.toContain('return "/provider/assistant";');
    expect(accountHome).toContain('return "/profile";');
    expect(dashboard).toContain("redirect(getKlyxAccountHome(profile));");
    expect(dashboard).not.toContain("profile.accountType");
  });

  it("authorizes market split planning by request_services instead of legacy role", () => {
    const route = compact(read("app/api/brain/market-split-plan/[id]/route.ts"));

    expect(route).toContain("if ( !profile.canRequestServices )");
    expect(route).not.toContain('profile.accountType !==');
    expect(route).toContain("marketRequest.client_profile_id !== profile.id");
  });
});
