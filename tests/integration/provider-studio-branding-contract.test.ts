import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider studio branding contract", () => {
  it("uses the exact KLYX blue while preserving Studio business boundaries", () => {
    const studio = read("app/components/ProviderStudio.tsx");

    expect(studio).toContain('fetch("/api/provider/studio"');
    expect(studio).toContain('method: "GET"');
    expect(studio).toContain('method: "PUT"');
    expect(studio).toContain('method: "POST"');
    expect(studio).toContain('method: "DELETE"');
    expect(studio).toContain('formData.append("kind", kind)');
    expect(studio).toContain('formData.append("file", file)');
    expect(studio).toContain('uploadMedia("gallery", file');
    expect(studio).toContain('uploadMedia(');
    expect(studio).toContain('"document",');
    expect(studio).toContain('window.confirm(t("deleteConfirm"))');
    expect(studio).toContain('onClick={() => void saveStudio(true)}');
    expect(studio).toContain('onClick={() => void saveStudio(false)}');
    expect(studio).toContain('updateService(serviceId, { enabled: true })');
    expect(studio).toContain('updateService(serviceId, { enabled: false })');

    expect(studio).toContain("#2563EB");

    for (const legacyBranding of [
      "blue-",
      "violet-",
      "indigo-",
      "fuchsia-",
      "linear-gradient",
      "bg-gradient",
    ]) {
      expect(studio).not.toContain(legacyBranding);
    }

    expect(studio).toContain("emerald-500");
    expect(studio).toContain("amber-500");
    expect(studio).toContain("red-500");
  });
});
