import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX memory and notification API error sanitization", () => {
  const routePaths = [
    "app/api/memory/preferences/route.ts",
    "app/api/memory/profile/route.ts",
    "app/api/notifications/read/route.ts",
  ] as const;

  it.each(routePaths)("%s uses the secure API error boundary", (relativePath) => {
    const source = read(relativePath);

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).not.toContain("console.error");
    expect(source).not.toMatch(/error:\s*message\b/);
    expect(source).toContain("publicMessage: status < 500 ? message : undefined");
  });

  it("does not expose Supabase memory provider messages", () => {
    const preferences = read("app/api/memory/preferences/route.ts");
    const profile = read("app/api/memory/profile/route.ts");

    expect(preferences).not.toContain("queryError.message");
    expect(preferences).not.toContain("upsertError.message");
    expect(profile).not.toContain("preferencesResult.error.message");
    expect(profile).not.toContain("profileResult.error.message");
    expect(profile).not.toContain("preferencesError.message");
    expect(profile).not.toContain("profileError.message");
    expect(profile).not.toContain("result.error.message");
  });

  it("logs non-blocking memory event failures structurally", () => {
    const preferences = read("app/api/memory/preferences/route.ts");
    const profile = read("app/api/memory/profile/route.ts");

    expect(preferences).toContain("logServerError({");
    expect(preferences).toContain('event: "memory_preferences_event_failed"');
    expect(profile).toContain("logServerError({");
    expect(profile).toContain('event: "memory_profile_event_failed"');
  });

  it("keeps missing notification validation as a public 400", () => {
    const notifications = read("app/api/notifications/read/route.ts");

    expect(notifications).toContain('{ error: "Notification manquante." }');
    expect(notifications).toContain("{ status: 400 }");
    expect(notifications).not.toContain("throw new Error(error.message)");
  });
});
