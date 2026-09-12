import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellPath = path.join(process.cwd(), "app/ui/AssistantShell.tsx");

describe("assistant-first recommendations shell contract", () => {
  it("keeps recommendation results out of the legacy AppSidebar routing", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    const legacyRoutes = source.match(
      /const routesWithLegacyShell = \[([\s\S]*?)\];/
    );

    expect(legacyRoutes).not.toBeNull();

    const legacyRouteSource = legacyRoutes?.[1] ?? "";
    expect(legacyRouteSource).not.toContain('"/recommendations"');
    expect(legacyRouteSource).toContain('"/founder"');
    expect(legacyRouteSource).toContain('"/admin"');
    expect(legacyRouteSource).toContain('"/providers"');

    expect(source).toContain("return <AppSidebar />;");
    expect(source).toContain("<MissionRail");
  });
});
