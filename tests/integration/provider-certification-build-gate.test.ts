import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/klyx-all-providers-certification.yml"), "utf8");

describe("provider certification build gate", () => {
  it("requires TypeScript and production build before mobile certification", () => {
    const typecheck = workflow.indexOf("TypeScript");
    const build = workflow.indexOf("Production build");
    const mobile = workflow.indexOf("Android and iOS PWA browser certification");

    expect(typecheck).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(typecheck);
    expect(mobile).toBeGreaterThan(build);
  });
});
