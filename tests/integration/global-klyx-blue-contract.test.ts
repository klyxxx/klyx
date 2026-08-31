import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX global brand blue contract", () => {
  it("uses the exact logo blue as the single global brand accent", () => {
    const visualSystem = read("app/klyx-visual-system.css");
    const logo = read("app/ui/KlyxLogo.tsx");

    expect(visualSystem).toContain("--klyx-blue: 37 99 235;");
    expect(logo).toContain('fill="#2563eb"');
    expect(visualSystem).not.toContain("--klyx-blue: 20 103 232;");
  });

  it("routes primary, ring and sidebar accents through the KLYX blue token", () => {
    const visualSystem = read("app/klyx-visual-system.css");

    expect(visualSystem.match(/--primary: rgb\(var\(--klyx-blue\)\);/g)?.length).toBe(2);
    expect(visualSystem.match(/--ring: rgb\(var\(--klyx-blue\)\);/g)?.length).toBe(2);
    expect(visualSystem.match(/--sidebar-primary: rgb\(var\(--klyx-blue\)\);/g)?.length).toBe(2);
  });

  it("keeps the global product surface neutral and gradient-free", () => {
    const visualSystem = read("app/klyx-visual-system.css");

    expect(visualSystem).toContain("background-image: none !important;");
    expect(visualSystem).not.toContain("linear-gradient(");
    expect(visualSystem).not.toContain("radial-gradient(");
  });
});
