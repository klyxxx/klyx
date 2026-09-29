import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX external provider readiness contract", () => {
  it("does not report Supabase configured without privileged server authority", () => {
    const registry = read("lib/providers/server-registry.ts");

    const supabaseCase = registry.split('case "supabase":')[1]?.split('case "stripe":')[0] ?? "";

    expect(supabaseCase).toContain('hasEnv("NEXT_PUBLIC_SUPABASE_URL")');
    expect(supabaseCase).toContain('hasEnv("SUPABASE_SERVICE_ROLE_KEY")');
  });

  it("does not report Turnstile configured from a public site key alone", () => {
    const registry = read("lib/providers/server-registry.ts");

    const turnstileCase = registry
      .split('case "cloudflare_turnstile":')[1]
      ?.split('case "elmah_io":')[0] ?? "";

    expect(turnstileCase).toContain(
      'hasEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY")'
    );
    expect(turnstileCase).toContain('hasEnv("TURNSTILE_SECRET_KEY")');
  });
});
