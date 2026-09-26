import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const root =
  process.cwd();

const routePath =
  path.join(
    root,
    "app",
    "api",
    "admin",
    "openai-health",
    "route.ts"
  );

describe(
  "KLYX OpenAI production health contract",
  () => {
    it(
      "keeps the OpenAI health probe admin-only, secret-safe and cost-guarded",
      () => {
        const source =
          fs.readFileSync(
            routePath,
            "utf8"
          );

        expect(source).toContain("requireKlyxAdmin()");
        expect(source).toContain("https://api.openai.com/v1/responses");
        expect(source).toContain("OPENAI_API_KEY");
        expect(source).toContain("KLYX_OPENAI_MODEL");
        expect(source).toContain('"gpt-5.6-luna"');
        expect(source).toContain("authorizeKlyxExternalCall");
        expect(source).toContain('operation: "health_probe"');
        expect(source).toContain("costGuarded: true");
        expect(source).toContain("AbortSignal.timeout");
        expect(source).toContain("configured: true");
        expect(source).toContain("apiStatus:");
        expect(source).not.toContain('from "vitest"');
        expect(source).not.toMatch(/apiKey\s*[:,]/);
        expect(source).not.toMatch(/OPENAI_API_KEY\s*[:,]/);
      }
    );
  }
);
