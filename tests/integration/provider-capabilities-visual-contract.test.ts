import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider capabilities visual contract", () => {
  it("keeps capability behavior while using the exact KLYX blue without branding overrides", () => {
    const capabilities = read("app/provider/capabilities/page.tsx");

    expect(capabilities).toContain('fetch("/api/provider/capabilities"');
    expect(capabilities).toContain('fetch("/api/provider/capability-links"');
    expect(capabilities).toContain('fetch("/api/provider/studio"');
    expect(capabilities).toContain('method: "POST"');
    expect(capabilities).toContain('method: "PATCH"');
    expect(capabilities).toContain('method: existing ? "DELETE" : "POST"');
    expect(capabilities).toContain("changeStatus(capability: Capability)");
    expect(capabilities).toContain("toggleLink(capabilityId: string, userServiceId: string)");

    expect(capabilities).toContain("#2563EB");
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
      expect(capabilities).not.toContain(legacyBranding);
    }

    expect(capabilities).toContain("emerald-500");
    expect(capabilities).toContain("amber-500");
    expect(capabilities).toContain("rose-500");

    expect(
      fs.existsSync(
        path.join(process.cwd(), "app/provider/capabilities/capabilities.module.css")
      )
    ).toBe(false);
    expect(
      fs.existsSync(path.join(process.cwd(), "app/provider/capabilities/layout.tsx"))
    ).toBe(false);
  });
});
