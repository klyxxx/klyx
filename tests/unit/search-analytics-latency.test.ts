import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/search/providers/route.ts"),
  "utf8"
);

describe("provider search analytics latency", () => {
  it("defers aggregate analytics until after the response", () => {
    expect(route).toContain('import { after } from "next/server"');
    expect(route).toMatch(
      /after\(async \(\) => \{[\s\S]*await\s+recordSearchOutcome\(request, response\);?[\s\S]*\}\);/
    );
    expect(route).not.toMatch(
      /const response = await providerSearchCore\(request\);[\s\S]*await\s+recordSearchOutcome\(request, response\);[\s\S]*return response;/
    );
  });
});
