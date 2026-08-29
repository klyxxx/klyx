import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const root =
  process.cwd();

function source(
  relativePath: string
) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath
    ),
    "utf8"
  );
}

describe(
  "KLYX zero-cost Brain contract",
  () => {
    it(
      "keeps paid OpenAI explicitly opt-in",
      () => {
        const ai =
          source(
            "lib/klyx-ai.ts"
          );

        expect(
          ai
        ).toMatch(
          /process\.env\.KLYX_OPENAI_ENABLED\s*!==\s*"1"/
        );

        expect(
          ai
        ).toContain(
          "!isKlyxAiEnabled()"
        );
      }
    );

    it(
      "preserves deterministic AI fallback when OpenAI is unavailable",
      () => {
        const ai =
          source(
            "lib/klyx-ai.ts"
          );

        expect(
          ai
        ).toContain(
          "function fallbackReply("
        );

        expect(
          ai
        ).toContain(
          'mode: "fallback"'
        );

        expect(
          ai
        ).toContain(
          "text: fallbackReply(message)"
        );
      }
    );

    it(
      "keeps Brain as a compatibility alias for the canonical assistant",
      () => {
        const page =
          source(
            "app/brain/page.tsx"
          );

        expect(
          page
        ).toContain(
          'import { redirect } from "next/navigation"'
        );

        expect(
          page
        ).toContain(
          'redirect("/assistant")'
        );

        expect(
          page
        ).not.toContain(
          'aiResult.mode === "openai"'
        );
      }
    );

    it(
      "recognizes compact explicit times server-side",
      () => {
        const route =
          source(
            "app/api/brain/respond/route.ts"
          );

        expect(
          route
        ).toContain(
          "KLYX_ZERO_COST_EXPLICIT_TIME_12B_7B"
        );

        expect(
          route
        ).toContain(
          "explicitTimeMatch"
        );
      }
    );
  }
);
