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

    const responseIndex = route.indexOf("const response = await providerSearchCore(request);");
    const afterIndex = route.indexOf("after(async () =>", responseIndex);
    const analyticsIndex = route.indexOf("await recordSearchOutcome(request, response);", afterIndex);
    const returnIndex = route.indexOf("return response;", analyticsIndex);

    expect(responseIndex).toBeGreaterThanOrEqual(0);
    expect(afterIndex).toBeGreaterThan(responseIndex);
    expect(analyticsIndex).toBeGreaterThan(afterIndex);
    expect(returnIndex).toBeGreaterThan(analyticsIndex);

    const criticalPath = route.slice(responseIndex, afterIndex);
    expect(criticalPath).not.toContain("recordSearchOutcome");
  });
});
