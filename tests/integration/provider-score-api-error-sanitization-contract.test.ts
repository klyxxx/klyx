import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("provider score API error sanitization contract", () => {
  it("sanitizes unexpected 5xx errors while preserving safe auth messages", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/scores/recalculate/route.ts"),
      "utf8"
    );

    expect(source).toContain("secureApiErrorResponse");
    expect(source).toContain('event: "provider_score_recalculate_failed"');
    expect(source).toContain('route: "/api/scores/recalculate"');
    expect(source).toContain('code: "provider_score_recalculate_failed"');
    expect(source).toContain("status < 500");
    expect(source).not.toContain("return NextResponse.json(\n      { error: message }");
  });
});
