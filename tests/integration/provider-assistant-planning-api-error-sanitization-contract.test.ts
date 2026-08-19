import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("provider assistant and planning API error sanitization contract", () => {
  it("keeps provider assistant business logic in its core and sanitizes public 5xx responses", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/assistant/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/assistant/assistant-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('route: "/api/provider/assistant"');
    expect(route).toContain("response.status < 500");
    expect(route).toContain("coreGet");
    expect(route).toContain("corePost");
    expect(route).toContain("corePatch");
    expect(route).not.toContain("return NextResponse.json(\n      { error: message }");

    expect(core).toContain("provider_assistant_drafts");
    expect(core).toContain("analyzeProviderAssistantMessage");
    expect(core).toContain("availability_slots");
    expect(core).toContain('status: "applied"');
  });

  it("keeps provider planning analysis in its core and sanitizes public 5xx responses", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/planning/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/planning/planning-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('event: "provider_planning_load_failed"');
    expect(route).toContain('route: "/api/provider/planning"');
    expect(route).toContain('code: "KLYX_PROVIDER_PLANNING_LOAD_FAILED"');
    expect(route).toContain("automaticChanges: false");
    expect(route).toContain("response.status < 500");
    expect(route).not.toContain("return NextResponse.json(\n      { error: message }");

    expect(core).toContain("analyzeProviderPlanning");
    expect(core).toContain("availability_slots");
    expect(core).toContain("automaticChanges: false");
  });
});
