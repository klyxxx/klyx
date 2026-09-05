import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider capabilities accessibility contract", () => {
  it("labels edit fields without changing capability or offer-link mutations", () => {
    const page = read("app/provider/capabilities/page.tsx");

    expect(page).toContain('value={editLabel}');
    expect(page).toContain('value={editDescription}');
    expect(page).toContain('className="text-xs font-black text-muted-foreground"');
    expect(page).toContain('{t("label")}');
    expect(page).toContain('{t("descriptionLabel")}');
    expect(page).toContain('{editDescription.length}/{DESCRIPTION_MAX_LENGTH}');

    expect(page).toContain('fetch("/api/provider/capabilities"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('fetch("/api/provider/capability-links"');
    expect(page).toContain('method: existing ? "DELETE" : "POST"');
    expect(page).toContain('body: JSON.stringify({ capabilityId, userServiceId })');
  });
});
