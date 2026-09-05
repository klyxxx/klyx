import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(
  path.join(
    process.cwd(),
    ".github/workflows/klyx-supabase-production-migrations.yml"
  ),
  "utf8"
);

const approvedHistoricalMigration =
  "supabase/migrations/20260904213000_klyx_profile_delete_execution_hardening.sql";

describe("Supabase production migration historical-gap recovery", () => {
  it("pins recovery to the single known KLYX historical migration", () => {
    expect(workflow).toContain(
      `approved_historical_migration="${approvedHistoricalMigration}"`
    );
    expect(workflow).toContain(
      'historical_gap_message="Found local migration files to be inserted before the last migration on remote database."'
    );
    expect(workflow).toContain(
      'if [ "${#historical_migrations[@]}" -ne 1 ] \\'
    );
    expect(workflow).toContain(
      '[ "${historical_migrations[0]:-}" != "$approved_historical_migration" ]'
    );
    expect(workflow).toContain(
      "Refusing --include-all: the historical migration gap is not the single approved KLYX migration."
    );
  });

  it("uses include-all only after the guarded standard dry-run failure", () => {
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --dry-run > migration-proof/dry-run-before.txt 2>&1'
    );
    expect(workflow).toContain(
      'supabase db push --linked --dry-run > migration-proof/dry-run-before.txt 2>&1'
    );
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --dry-run --include-all \\'
    );
    expect(workflow).toContain(
      'supabase db push --linked --dry-run --include-all \\'
    );
    expect(workflow).toContain(
      'echo "SUPABASE_INCLUDE_ALL=true" >> "$GITHUB_ENV"'
    );
  });

  it("keeps the production write conditional and verifies with a normal dry-run", () => {
    expect(workflow).toContain(
      'if [ "${SUPABASE_INCLUDE_ALL:-false}" = "true" ]; then'
    );
    expect(workflow).toContain("push_args+=(--include-all)");
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" "${push_args[@]}"'
    );
    expect(workflow).toContain(
      'supabase db push --linked "${push_args[@]}"'
    );
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --dry-run | tee migration-proof/dry-run-after.txt'
    );
    expect(workflow).toContain(
      'supabase db push --linked --dry-run | tee migration-proof/dry-run-after.txt'
    );
  });
});
