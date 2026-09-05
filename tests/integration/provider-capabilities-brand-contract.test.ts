import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const capabilitiesPage = readFileSync(
  join(process.cwd(), "app/provider/capabilities/page.tsx"),
  "utf8"
);

describe("provider capabilities brand contract", () => {
  it("keeps the visible capabilities accent on the canonical KLYX blue", () => {
    expect(capabilitiesPage).toContain("#2563EB");
    expect(capabilitiesPage).not.toContain("#60a5fa");
    expect(capabilitiesPage).not.toContain("violet-");
    expect(capabilitiesPage).not.toContain("linear-gradient");
    expect(capabilitiesPage).not.toContain("bg-gradient");
    expect(capabilitiesPage).not.toContain("indigo-");

    expect(
      existsSync(
        join(process.cwd(), "app/provider/capabilities/capabilities.module.css")
      )
    ).toBe(false);
  });
});
