import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("unified assistant server guard", () => {
  it("validates auth and an active account before rendering assistant children", () => {
    const layout = read("app/assistant/layout.tsx");

    expect(layout).toContain('redirect("/login")');
    expect(layout).toContain('redirect("/accounts")');
    expect(layout).toContain("getActiveProfile()");
    expect(layout).not.toContain('profile.accountType !== "client"');
    expect(layout).not.toContain("getKlyxAccountHome");

    const activeProfileCheck = layout.indexOf("if (!profile)");
    const childrenRender = layout.indexOf("return children");
    expect(activeProfileCheck).toBeGreaterThan(-1);
    expect(childrenRender).toBeGreaterThan(activeProfileCheck);
  });

  it("renders the same AssistantThread without a client-only route guard", () => {
    const page = read("app/assistant/page.tsx");
    expect(page).toContain("<AssistantThread />");
    expect(page).not.toContain("ClientRouteGuard");
  });
});
