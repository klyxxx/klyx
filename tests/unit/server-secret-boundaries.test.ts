import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const serverSecretModules = [
  "lib/supabase-admin.ts",
  "lib/stripe-runtime.ts",
  "lib/sumsub.ts",
] as const;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("server secret boundaries", () => {
  for (const relativePath of serverSecretModules) {
    it(`keeps ${relativePath} server-only`, () => {
      expect(read(relativePath)).toMatch(/^import "server-only";/);
    });
  }

  it("keeps critical committed-secret signatures in the repository scanner", () => {
    const audit = read("scripts/security/security-audit.mjs");

    expect(audit).toContain('id: "stripe-secret-key"');
    expect(audit).toContain('id: "stripe-webhook-secret"');
    expect(audit).toContain('id: "openai-api-key"');
    expect(audit).toContain('id: "supabase-secret-key"');
    expect(audit).toContain('id: "github-token"');
    expect(audit).toContain('id: "private-key"');
  });
});
