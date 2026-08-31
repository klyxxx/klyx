import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider studio visual contract", () => {
  it("keeps the real provider studio actions while rendering legacy violet as KLYX blue", () => {
    const page = read("app/provider/studio/page.tsx");
    const theme = read("app/provider/studio/studio.module.css");
    const studio = read("app/components/ProviderStudio.tsx");

    expect(page).toContain('import styles from "./studio.module.css"');
    expect(page).toContain("className={styles.studio}");
    expect(page).toContain("<ProviderReadinessStatus />");
    expect(page).toContain("<ProviderCapabilitiesEntry />");
    expect(page).toContain("<ProviderStudio profileId={profile.id} />");

    expect(theme).toContain("--klyx-studio-blue: #2563eb");
    expect(theme).toContain('[class~="bg-gradient-to-br"]');
    expect(theme).toContain('[class~="text-violet-400"]');
    expect(theme).toContain('[class~="bg-violet-600"]');
    expect(theme).toContain('[class~="accent-violet-600"]');
    expect(theme).not.toContain("#7c3aed");
    expect(theme).not.toContain("indigo");

    expect(studio).toContain('fetch("/api/provider/studio"');
    expect(studio).toContain('method: "GET"');
    expect(studio).toContain('method: "PUT"');
    expect(studio).toContain('method: "POST"');
    expect(studio).toContain('method: "DELETE"');
    expect(studio).toContain("saveStudio(true)");
    expect(studio).toContain("uploadMedia(\"gallery\"");
    expect(studio).toContain("uploadMedia(\"document\"");
  });
});
