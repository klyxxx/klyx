import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider skills branding contract", () => {
  it("uses the exact KLYX blue while preserving verification and storage boundaries", () => {
    const skills = read("app/provider/skills/page.tsx");
    const requirements = read(
      "app/provider/skills/SkillRequirementsPanel.tsx"
    );
    const source = `${skills}\n${requirements}`;

    expect(skills).toContain("getActiveClientProfile()");
    expect(skills).toContain("supabase.auth.getSession()");
    expect(skills).toContain('fetch("/api/provider/skills-verification"');
    expect(skills).toContain('method: "POST"');
    expect(skills).toContain('method: "PATCH"');
    expect(skills).toContain('.from("provider-verification")');
    expect(skills).toContain(".upload(path, file");
    expect(skills).toContain(".remove([path])");
    expect(skills).toContain("requirementsReady[skill.userServiceId] !== true");
    expect(skills).toContain("onClick={() => void save(skill, true)}");

    expect(requirements).toContain("supabase.auth.getSession()");
    expect(requirements).toContain(
      "/api/provider/skill-requirements?userServiceId=${encodeURIComponent("
    );
    expect(requirements).toContain(
      "onReadyChange(userServiceId, body.evaluation?.ready === true)"
    );

    expect(skills).toContain("#2563EB");
    expect(requirements).toContain("#2563EB");

    for (const legacyBranding of [
      "blue-300",
      "blue-400",
      "blue-500",
      "blue-600",
      "blue-700",
      "violet-",
      "indigo-",
      "fuchsia-",
      "linear-gradient",
      "bg-gradient",
      "#2b1452",
    ]) {
      expect(source).not.toContain(legacyBranding);
    }

    expect(source).toContain("emerald-500");
    expect(source).toContain("amber-500");
    expect(source).toContain("rose-500");
  });
});
