import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX public homepage assistant-first UX", () => {
  it("uses the same neutral and single-blue visual language as the product", () => {
    const home = read("app/components/PublicHomeContent.tsx");
    const actions = read("app/components/PublicSessionActions.tsx");
    const logo = read("app/ui/KlyxLogo.tsx");

    expect(home).not.toContain("violet-");
    expect(home).not.toContain("indigo-");
    expect(home).not.toContain("gradient");
    expect(actions).not.toContain("violet-");
    expect(actions).not.toContain("indigo-");
    expect(home).toContain("bg-blue-600");
    expect(actions).toContain("bg-blue-600");
    expect(logo).toContain('fill="#2563eb"');
    expect(logo).not.toContain("#7c3aed");
  });

  it("puts the assistant question and the client action before secondary content", () => {
    const home = read("app/components/PublicHomeContent.tsx");

    expect(home).toContain('t("assistantQuestion")');
    expect(home).toContain('t("assistantExample")');
    expect(home.indexOf("<PublicSessionActions />")).toBeLessThan(
      home.indexOf('t("journeyEyebrow")')
    );
  });

  it("keeps client and provider signup explicit and separate", () => {
    const home = read("app/components/PublicHomeContent.tsx");

    expect(home).toContain('href="/signup?type=client"');
    expect(home).toContain('href="/signup?type=provider"');
    expect(home).toContain('t("clientDescription")');
    expect(home).toContain('t("providerDescription")');
    expect(home).toContain('t("roleNote")');
  });
});
