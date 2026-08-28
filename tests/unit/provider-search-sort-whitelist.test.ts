import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const core = fs.readFileSync(
  path.join(process.cwd(), "app/api/search/providers/providers-route-core.ts"),
  "utf8"
);

const shared = fs.readFileSync(
  path.join(process.cwd(), "lib/provider-search.ts"),
  "utf8"
);

describe("provider search sort whitelist", () => {
  it("accepts every shared provider search sort", () => {
    const whitelistStart = core.indexOf("const SORT_VALUES");
    const whitelistEnd = core.indexOf("];", whitelistStart);
    const whitelist = core.slice(whitelistStart, whitelistEnd);

    expect(whitelistStart).toBeGreaterThanOrEqual(0);
    expect(whitelist).toContain('"recommended"');
    expect(whitelist).toContain('"price_asc"');
    expect(whitelist).toContain('"rating_desc"');
    expect(whitelist).toContain('"score_desc"');
    expect(whitelist).toContain('"experience_desc"');

    expect(shared).toContain('"rating_desc"');
  });
});
