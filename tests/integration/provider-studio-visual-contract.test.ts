import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider studio visual contract", () => {
  it("renders Services natively with the Aura/Noir semantic theme and no legacy shim", () => {
    const page = read("app/provider/studio/page.tsx");
    const studio = read("app/components/ProviderStudio.tsx");
    const studioI18n = read("lib/klyx-provider-studio-i18n.ts");

    expect(page).not.toContain("studio.module.css");
    expect(page).not.toContain("styles.studio");
    expect(page).toContain("<ProviderReadinessStatus />");
    expect(page).toContain("<ProviderCapabilitiesEntry />");
    expect(page).toContain("<ProviderStudio profileId={profile.id} />");

    expect(studio).toContain("text-primary");
    expect(studio).toContain("bg-primary");
    expect(studio).toContain("text-primary-foreground");
    expect(studio).toContain("accent-primary");
    expect(studio).toContain('{t("pageTitle")}');
    expect(studioI18n).toContain('pageTitle: "Configurer mes services"');

    expect(studio).not.toMatch(
      /#2563EB|blue-|violet-|indigo-|fuchsia-|gradient|Tableau de bord|KLYX_PROVIDER_STUDIO_NATIVE_SINGLE_BLUE/
    );
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
    expect(studio).toMatch(/uploadMedia\(\s*"document",\s*file,/);
  });
});
