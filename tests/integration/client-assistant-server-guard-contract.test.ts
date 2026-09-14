import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("assistant canonical account capability guard", () => {
  it("validates auth and request capability before rendering assistant children", () => {
    const layout = read("app/assistant/layout.tsx");

    expect(layout).toContain('redirect("/login")');
    expect(layout).toContain('redirect("/accounts")');
    expect(layout).toContain("!profile.canRequestServices");
    expect(layout).not.toContain('profile.accountType !== "client"');

    const capabilityCheck = layout.indexOf("!profile.canRequestServices");
    const childrenRender = layout.indexOf("return children");
    expect(capabilityCheck).toBeGreaterThan(-1);
    expect(childrenRender).toBeGreaterThan(capabilityCheck);
  });

  it("keeps the client-side route guard as a second defense layer", () => {
    const page = read("app/assistant/page.tsx");
    expect(page).toContain("<ClientRouteGuard>");

    const guard = read("app/components/ClientRouteGuard.tsx");
    expect(guard).toContain("canRequestServices");
    expect(guard).not.toContain('body.profile.accountType === "provider"');
  });
});
