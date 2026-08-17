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
        ).toContain(
          'process.env.KLYX_OPENAI_ENABLED === "1"'
        );

        expect(
          ai
        ).toContain(
          "!isKlyxAiEnabled()"
        );
      }
    );

    it(
      "preserves deterministic Brain replies when OpenAI is unavailable",
      () => {
        const page =
          source(
            "app/brain/page.tsx"
          );

        expect(
          page
        ).toContain(
          'aiResult.mode === "openai"'
        );

        expect(
          page
        ).toContain(
          "KLYX_ZERO_COST_READINESS_SYNC_12B_7B"
        );

        expect(
          page
        ).toContain(
          'missing.push('
        );

        expect(
          page
        ).toContain(
          '"heure"'
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
