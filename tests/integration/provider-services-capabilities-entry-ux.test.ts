import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX provider Services capabilities entry UX", () => {
  it("keeps capabilities secondary to the main Services surface", () => {
    const component = read("app/components/ProviderCapabilitiesEntry.tsx");

    expect(component).toContain('href="/provider/capabilities"');
    expect(component).toContain('t("entryTitle")');
    expect(component).toContain('t("entryDescription")');
    expect(component).toContain('t("entryCta")');
    expect(component).toContain("min-h-10");
    expect(component).not.toContain("h-12 w-12");
  });

  it("uses the definitive single-blue KLYX visual language", () => {
    const component = read("app/components/ProviderCapabilitiesEntry.tsx");

    expect(component).toContain("text-blue-600");
    expect(component).toContain("bg-blue-600/10");
    expect(component).not.toContain("violet-");
    expect(component).not.toContain("indigo-");
    expect(component).not.toContain("gradient");
  });
});
