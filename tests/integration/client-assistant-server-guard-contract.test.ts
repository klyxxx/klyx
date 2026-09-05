import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("client assistant server role guard", () => {
  it("validates auth and active client role before rendering assistant children", () => {
    const layout = read("app/assistant/layout.tsx");

    expect(layout).toContain('redirect("/login")');
    expect(layout).toContain('redirect("/accounts")');
    expect(layout).toContain('profile.accountType !== "client"');
    expect(layout).toContain("redirect(getKlyxAccountHome(profile.accountType))");

    const roleCheck = layout.indexOf('profile.accountType !== "client"');
    const childrenRender = layout.indexOf("return children");
    expect(roleCheck).toBeGreaterThan(-1);
    expect(childrenRender).toBeGreaterThan(roleCheck);
  });

  it("keeps the client-side route guard as a second defense layer", () => {
    const page = read("app/assistant/page.tsx");
    expect(page).toContain("<ClientRouteGuard>");
  });
});
