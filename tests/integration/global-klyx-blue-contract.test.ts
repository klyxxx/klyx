import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX Aura / Noir global theme contract", () => {
  it("uses the shared violet accent and the selected Aura/Noir surfaces", () => {
    const visualSystem = read("app/klyx-visual-system.css");

    expect(visualSystem).toContain("--klyx-accent: 124 58 237;");
    expect(visualSystem).toContain("--background: rgb(247 245 255);");
    expect(visualSystem).toContain("--card: rgb(255 255 255);");
    expect(visualSystem).toContain("--foreground: rgb(24 17 46);");
    expect(visualSystem).toContain("--background: rgb(11 11 18);");
    expect(visualSystem).toContain("--card: rgb(23 26 40);");
    expect(visualSystem).toContain("--foreground: rgb(243 244 246);");
    expect(visualSystem).not.toContain("--klyx-blue:");
  });

  it("routes primary, ring and sidebar accents through the KLYX accent token", () => {
    const visualSystem = read("app/klyx-visual-system.css");

    expect(visualSystem.match(/--primary: rgb\(var\(--klyx-accent\)\);/g)?.length).toBe(2);
    expect(visualSystem.match(/--ring: rgb\(var\(--klyx-accent\)\);/g)?.length).toBe(2);
    expect(visualSystem.match(/--sidebar-primary: rgb\(var\(--klyx-accent\)\);/g)?.length).toBe(2);
  });

  it("keeps the global product surface gradient-free", () => {
    const visualSystem = read("app/klyx-visual-system.css");

    expect(visualSystem).toContain("background-image: none !important;");
    expect(visualSystem).not.toContain("linear-gradient(");
    expect(visualSystem).not.toContain("radial-gradient(");
  });
});
