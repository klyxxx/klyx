import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX brain actions API error sanitization contract", () => {
  it("uses the secure API error boundary for unexpected GET failures", () => {
    const source = read("app/api/brain/actions/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain('event: "brain_actions_load_failed"');
    expect(source).toContain('code: "KLYX_BRAIN_ACTIONS_LOAD_FAILED"');
    expect(source).toContain('route: "/api/brain/actions"');
    expect(source).not.toContain("{ error: message }");
    expect(source).not.toContain("apiErrorStatus(");
  });

  it("preserves the no-automatic-execution safety contract", () => {
    const source = read("app/api/brain/actions/route.ts");

    expect(source).toContain("automaticExecutionAllowed:");
    expect(source).toContain("false,");
    expect(source).toContain("details: {");
    expect(source).toContain("groupCancellationAware:");
  });

  it("preserves group cancellation action filtering", () => {
    const source = read("app/api/brain/actions/route.ts");

    expect(source).toContain("KLYX_GROUP_ACTION_CENTER_12_91");
    expect(source).toContain("getGroupCancellationBrainActions(");
    expect(source).toContain("protectedGroupHrefs");
    expect(source).toContain("protectedHrefs.has(");
  });
});
