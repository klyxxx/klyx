import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("assistant canonical account capability guard", () => {
  it("requires authentication before rendering the unified assistant", () => {
    const layout = read("app/assistant/layout.tsx");

    expect(layout).toContain('redirect("/login")');
    expect(layout).toContain("return children");
    expect(layout).not.toContain('profile.accountType !== "client"');
    expect(layout).not.toContain("!profile.canRequestServices");
  });

  it("keeps capability authorization account-first at the assistant API boundary", () => {
    const page = read("app/assistant/page.tsx");
    expect(page).toContain("<AssistantThread />");
    expect(page).not.toContain("<ClientRouteGuard>");

    const route = read("app/api/brain/converse/route.ts");
    const auth = read("lib/api-auth.ts");
    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(auth).toContain("loadAccountCapabilityState(");
    expect(auth).toContain("canonicalProfile.canRequestServices");
    expect(auth).toContain("canonicalProfile.canOfferServices");
    expect(auth).not.toContain('profile.accountType !== "client"');
  });
});
