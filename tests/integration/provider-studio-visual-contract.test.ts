import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider studio visual contract", () => {
  it("renders Services natively in the definitive KLYX language without a legacy theme shim", () => {
    const page = read("app/provider/studio/page.tsx");
    const studio = read("app/components/ProviderStudio.tsx");

    expect(page).not.toContain("studio.module.css");
    expect(page).not.toContain("styles.studio");
    expect(page).toContain("<ProviderReadinessStatus />");
    expect(page).toContain("<ProviderCapabilitiesEntry />");
    expect(page).toContain("<ProviderStudio profileId={profile.id} />");

    expect(studio).toContain("KLYX_PROVIDER_STUDIO_NATIVE_SINGLE_BLUE");
    expect(studio).toContain("text-blue-600");
    expect(studio).toContain("bg-blue-600");
    expect(studio).toContain("accent-blue-600");
    expect(studio).toContain("Configurer mes services");
    expect(studio).not.toContain("violet-");
    expect(studio).not.toContain("indigo-");
    expect(studio).not.toContain("fuchsia-");
    expect(studio).not.toContain("gradient");
    expect(studio).not.toContain("Tableau de bord");
  });

  it("preserves the real provider Studio actions and unified API boundary", () => {
    const studio = read("app/components/ProviderStudio.tsx");

    expect(studio).toContain('fetch("/api/provider/studio"');
    expect(studio).toContain('method: "GET"');
    expect(studio).toContain('method: "PUT"');
    expect(studio).toContain('method: "POST"');
    expect(studio).toContain('method: "DELETE"');
    expect(studio).toContain("saveStudio(true)");
    expect(studio).toContain("saveStudio(false)");
    expect(studio).toContain('uploadMedia("gallery"');
    expect(studio).toContain('uploadMedia("document"');
  });
});
