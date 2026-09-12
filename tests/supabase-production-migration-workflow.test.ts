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

const approvedHistoricalMigrations = [
  "20260905235000_klyx_activity_hidden_missions.sql",
  "20260905235500_klyx_core_payment_rpc_execution_sentinel.sql",
  "20260906000500_klyx_handle_new_user_search_path.sql",
  "20260906081500_klyx_remaining_rls_initplan_optimization.sql",
  "20260906083000_klyx_public_availability_rpc_hardening.sql",
  "20260906083500_klyx_profiles_stripe_index_history_preflight.sql",
  "20260906084000_klyx_profiles_stripe_duplicate_index_cleanup.sql",
  "20260906084500_klyx_message_notification_fk_indexes.sql",
];

describe("Supabase production migration historical-gap recovery", () => {
  it("pins recovery to the exact audited KLYX historical migration set", () => {
    expect(workflow).toContain("approved_historical_migrations=(");

    for (const migration of approvedHistoricalMigrations) {
      expect(workflow).toContain(`"${migration}"`);
    }

    expect(workflow).not.toContain(
      'approved_historical_migration="supabase/migrations/20260904213000_klyx_profile_delete_execution_hardening.sql"'
    );
    expect(workflow).toContain(
      'historical_gap_message="Found local migration files to be inserted before the last migration on remote database."'
    );
    expect(workflow).toContain(
      'if [ "${#historical_migrations[@]}" -ne "${#approved_historical_sorted[@]}" ]; then'
    );
    expect(workflow).toContain(
      "Refusing --include-all: historical migration count differs from the audited production gap."
    );
    expect(workflow).toContain(
      "Refusing --include-all: historical migration set differs from the audited production gap."
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
      "Refusing production write: second dry-run batch differs from the audited reconciliation batch."
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
