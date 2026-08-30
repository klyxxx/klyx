import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX public provider CTA", () => {
  it("keeps the visible provider label actionable", () => {
    const source = read("app/components/PublicHomeContent.tsx");

    expect(source).toMatch(
      /<Link\s+href="\/signup\?type=provider"\s+className="mt-6 inline-flex[^"]*"\s*>\s+\{t\("providerLabel"\)\}\s+<\/Link>/
    );

    expect(source).not.toMatch(
      /<p[^>]*>\s+\{t\("providerLabel"\)\}\s+<\/p>/
    );
  });
});
