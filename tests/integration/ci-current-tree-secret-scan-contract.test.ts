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
  "KLYX CI current-tree secret scan contract",
  () => {
    it(
      "keeps the current-tree scanner portable",
      () => {
        const scanner =
          source(
            "scripts/check-klyx-public-repo-secrets.ps1"
          );

        expect(
          scanner
        ).toContain(
          "KLYX_CURRENT_TREE_CI_PORTABLE_PHASE_12A_9"
        );

        expect(
          scanner
        ).toContain(
          "$PSScriptRoot"
        );

        expect(
          scanner
        ).toContain(
          "git ls-files"
        );

        expect(
          scanner
        ).not.toContain(
          "C:\\Users\\fenjo\\Documents\\klyx"
        );

        expect(
          scanner
        ).not.toContain(
          "$ExpectedBranch"
        );

        expect(
          scanner
        ).not.toContain(
          "git fetch --all --prune"
        );
      }
    );

    it(
      "runs current-tree scanning inside protected CI",
      () => {
        const workflow =
          source(
            ".github/workflows/klyx-e2e.yml"
          );

        expect(
          workflow
        ).toContain(
          "name: Playwright browser verification"
        );

        expect(
          workflow
        ).toContain(
          "KLYX_CURRENT_TREE_SECRET_SCAN_PHASE_12A_9"
        );

        expect(
          workflow
        ).toContain(
          "run: ./scripts/check-klyx-public-repo-secrets.ps1"
        );
      }
    );

    it(
      "does not run deep Git history scanning on every CI",
      () => {
        const workflow =
          source(
            ".github/workflows/klyx-e2e.yml"
          );

        expect(
          workflow
        ).not.toContain(
          "check-klyx-git-history-secrets.ps1"
        );
      }
    );
  }
);
