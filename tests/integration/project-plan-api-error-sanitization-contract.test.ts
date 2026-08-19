import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/projects/plan/route.ts"
);

describe("KLYX project planning API error sanitization contract", () => {
  it("uses the secure API error boundary", () => {
    const source = fs.readFileSync(routePath, "utf8");

    expect(source).toContain(
      'from "@/lib/api-error"'
    );
    expect(source).toContain(
      "secureApiErrorResponse({"
    );
    expect(source).toContain(
      'event: "project_plan_create_failed"'
    );
    expect(source).toContain(
      'code: "KLYX_PROJECT_PLAN_CREATE_FAILED"'
    );
    expect(source).toContain(
      "publicMessage: status < 500 ? message : undefined"
    );
  });

  it("does not expose Supabase messages or raw console errors", () => {
    const source = fs.readFileSync(routePath, "utf8");

    expect(source).not.toContain(
      "projectError.message"
    );
    expect(source).not.toContain(
      "servicesError.message"
    );
    expect(source).not.toContain(
      "console.error"
    );
  });

  it("keeps the missing-description validation public", () => {
    const source = fs.readFileSync(routePath, "utf8");

    expect(source).toContain(
      '"Décris le projet que tu veux organiser."'
    );
    expect(source).toMatch(
      /status:\s*400/
    );
  });
});
