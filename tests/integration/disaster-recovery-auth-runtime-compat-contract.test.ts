import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const workflow = read(
  ".github/workflows/klyx-supabase-full-restore-drill.yml"
);

describe("KLYX DR Auth runtime compatibility", () => {
  it("pins only the isolated GoTrue runtime to the production-compatible version", () => {
    expect(workflow).toContain(
      'KLYX_DR_GOTRUE_VERSION: "v2.197.0"'
    );
    expect(workflow).toContain(
      'version: 2.111.0'
    );
    expect(workflow).toContain(
      'KLYX_DR_SUPABASE_POSTGRES_IMAGE: "supabase/postgres:17.6.1.156"'
    );
    expect(workflow).toContain(
      '$KLYX_FULL_DR_LAB_ROOT/supabase/.temp/gotrue-version'
    );
  });

  it("writes the Auth image override after isolated init and before database start", () => {
    const initIndex = workflow.indexOf(
      'supabase --workdir "$KLYX_FULL_DR_LAB_ROOT" init --force'
    );
    const overrideIndex = workflow.indexOf(
      'printf \'%s\\n\' "$KLYX_DR_GOTRUE_VERSION"'
    );
    const dbStartIndex = workflow.indexOf(
      'supabase --workdir "$KLYX_FULL_DR_LAB_ROOT" db start'
    );

    expect(initIndex).toBeGreaterThan(-1);
    expect(overrideIndex).toBeGreaterThan(initIndex);
    expect(dbStartIndex).toBeGreaterThan(overrideIndex);
  });

  it("keeps the full production Auth snapshot authoritative", () => {
    expect(workflow).toContain(
      '-f "$KLYX_FULL_DR_DB_ROOT/auth-data.sql"'
    );
    expect(workflow).toContain('--schema auth');
    expect(workflow).toContain('--data-only');
    expect(workflow).toContain('--use-copy');
    expect(workflow).toContain(
      '--file /tmp/klyx-full-dr/auth-data.sql'
    );

    expect(workflow).not.toContain(
      'grep -v "mfa_recovery_code_sets"'
    );
    expect(workflow).not.toContain(
      'grep -v "mfa_recovery_codes"'
    );
    expect(workflow).not.toContain(
      'DROP TABLE auth.mfa_recovery_code_sets'
    );
  });

  it("keeps the restore lab unlinked and production read-only", () => {
    expect(workflow).toContain(
      "Isolated restore lab must never be linked."
    );
    expect(workflow).not.toContain("supabase link");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).toContain("production_write=false");
  });
});
