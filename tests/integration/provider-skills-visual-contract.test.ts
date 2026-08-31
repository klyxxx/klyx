import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider skills visual contract", () => {
  it("aligns provider skills with the KLYX theme without replacing qualification flows", () => {
    const layout = read("app/provider/skills/layout.tsx");
    const theme = read("app/provider/skills/skills.module.css");
    const page = read("app/provider/skills/page.tsx");
    const requirements = read("app/provider/skills/SkillRequirementsPanel.tsx");

    expect(layout).toContain('import styles from "./skills.module.css"');
    expect(layout).toContain("className={styles.skills}");

    expect(theme).toContain("--klyx-skills-blue: #2563eb");
    expect(theme).toContain('section[class*="bg-[linear-gradient"]');
    expect(theme).toContain("background-image: none");
    expect(theme).toContain("font-size: clamp(1.75rem, 4vw, 2.5rem)");
    expect(theme).toContain('[class~="bg-violet-600"]');
    expect(theme).toContain('[class~="text-violet-600"]');
    expect(theme).toContain('[class~="border-violet-500/20"]');
    expect(theme).not.toContain("#7c3aed");
    expect(theme).not.toContain("indigo");

    expect(page).toContain('fetch("/api/provider/skills-verification"');
    expect(page).toContain('.from("provider-verification")');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain("<SkillRequirementsPanel");

    expect(requirements).toContain("/api/provider/skill-requirements?userServiceId=");
    expect(requirements).toContain("onReadyChange(userServiceId");
    expect(requirements).toContain('rule.ruleLevel === "regulated"');
  });
});
