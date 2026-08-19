import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public services API error sanitization contract", () => {
  it("uses the secure API error boundary without exposing raw database messages", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/services/public/route.ts"),
      "utf8"
    );

    expect(source).toContain("secureApiErrorResponse");
    expect(source).toContain('event: "public_services_load_failed"');
    expect(source).toContain('route: "/api/services/public"');
    expect(source).toContain('code: "public_services_load_failed"');
    expect(source).not.toContain("error instanceof Error ? error.message");
    expect(source).not.toContain("NextResponse.json(\n      { error:");
  });
});
