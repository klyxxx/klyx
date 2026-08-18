import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const workflow =
  fs.readFileSync(
    path.join(
      process.cwd(),
      ".github/workflows/klyx-e2e.yml"
    ),
    "utf8"
  ).replace(/\r\n/g, "\n");

describe(
  "KLYX CI single-run contract",
  () => {
    it(
      "keeps manual workflow execution",
      () => {
        expect(workflow)
          .toContain(
            "workflow_dispatch:"
          );
      }
    );

    it(
      "runs push CI only on main",
      () => {
        expect(workflow)
          .toContain(
            "KLYX_CI_SINGLE_EVENT_PHASE_12A_10"
          );

        expect(workflow)
          .toContain(
            `push:
    branches:
      - main`
          );

        expect(workflow)
          .not.toContain(
            'agent/**'
          );
      }
    );

    it(
      "keeps pull request validation on main",
      () => {
        expect(workflow)
          .toContain(
            `pull_request:
    branches:
      - main`
          );
      }
    );

    it(
      "preserves the protected job name",
      () => {
        const occurrences =
          workflow
            .split(
              "name: Playwright browser verification"
            )
            .length - 1;

        expect(occurrences)
          .toBe(1);
      }
    );
  }
);
