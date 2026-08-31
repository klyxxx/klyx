import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider capabilities visual contract", () => {
  it("renders legacy capabilities styling through the KLYX blue theme without changing actions", () => {
    const layout = read("app/provider/capabilities/layout.tsx");
    const theme = read("app/provider/capabilities/capabilities.module.css");
    const page = read("app/provider/capabilities/page.tsx");

    expect(layout).toContain('import styles from "./capabilities.module.css"');
    expect(layout).toContain("className={styles.capabilities}");

    expect(theme).toContain("--klyx-capabilities-blue: #2563eb");
    expect(theme).toContain('section[class*="bg-[linear-gradient"]');
    expect(theme).toContain('[class~="text-violet-600"]');
    expect(theme).toContain('[class~="bg-violet-600"]');
    expect(theme).toContain("background-image: none");
    expect(theme).not.toContain("#7c3aed");
    expect(theme).not.toContain("indigo");

    expect(page).toContain('fetch("/api/provider/capabilities"');
    expect(page).toContain('fetch("/api/provider/capability-links"');
    expect(page).toContain('fetch("/api/provider/studio"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('method: existing ? "DELETE" : "POST"');
  });
});
