import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX request summary and recommendations UX", () => {
  it("keeps the editable summary action-first and visually aligned with KLYX", () => {
    const page = read("app/request/confirm/page.tsx");

    expect(page).toContain("KLYX_REQUEST_CONFIRM_NAVIGATION_ONLY");
    expect(page).toContain('bg-blue-600');
    expect(page).toContain('text-blue-600');
    expect(page).not.toContain("violet");
    expect(page).not.toContain("indigo");
    expect(page).not.toContain("linear-gradient");
  });

  it("renders one primary recommendation and at most two alternatives", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("const topProviders = result.providers.slice(0, 3);");
    expect(page).toContain("const primaryProvider = topProviders[0] ?? null;");
    expect(page).toContain("const alternativeProviders = topProviders.slice(1, 3);");
    expect(page).toContain("provider={primaryProvider}");
    expect(page).toContain("alternativeProviders.map");
    expect(page).toContain("featured");
  });

  it("keeps recommendations read-only and uses the single KLYX blue", () => {
    const page = read("app/recommendations/page.tsx");

    expect(page).toContain("KLYX_RECOMMENDATIONS_READ_ONLY");
    expect(page).toContain('requestParams.set("sort", "recommended")');
    expect(page).toContain('bg-blue-600');
    expect(page).toContain('text-blue-600');
    expect(page).not.toContain("violet");
    expect(page).not.toContain("indigo");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });
});
