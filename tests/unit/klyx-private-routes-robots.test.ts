import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX private route indexing policy", () => {
  it("disallows sensitive application surfaces in robots metadata", () => {
    const source = read("app/robots.ts");

    for (const route of [
      "/api/",
      "/admin/",
      "/founder/",
      "/accounts",
      "/dashboard",
      "/messages",
      "/settings",
      "/bookings",
      "/connect",
      "/checkout",
      "/payments",
    ]) {
      expect(source).toContain(`"${route}"`);
    }
  });

  it("noindexes admin and founder layouts as defense in depth", () => {
    for (const relativePath of ["app/admin/layout.tsx", "app/founder/layout.tsx"]) {
      const source = read(relativePath);
      expect(source).toContain("index: false");
      expect(source).toContain("follow: false");
      expect(source).toContain("nocache: true");
    }
  });
});
