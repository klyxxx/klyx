import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const capabilitiesCss = readFileSync(
  join(
    process.cwd(),
    "app/provider/capabilities/capabilities.module.css"
  ),
  "utf8"
);

describe("provider capabilities brand contract", () => {
  it("keeps the visible capabilities accent on the canonical KLYX blue", () => {
    expect(capabilitiesCss).toContain("--klyx-capabilities-blue: #2563eb;");
    expect(capabilitiesCss).toContain(
      "--klyx-capabilities-blue-text: #2563eb;"
    );
    expect(capabilitiesCss).toContain(
      "color: var(--klyx-capabilities-blue-text) !important;"
    );
    expect(capabilitiesCss).toContain(
      "background-color: var(--klyx-capabilities-blue) !important;"
    );
    expect(capabilitiesCss).not.toContain("#60a5fa");
  });
});
