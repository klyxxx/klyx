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
  "20260913003000_klyx_trust_review_resolution_rpc.sql",
  "20260913004000_klyx_trust_latest_decision_enforcement.sql",
];

const approvedReconciliationBatch = [
  "20260913003000_klyx_trust_review_resolution_rpc.sql",
  "20260913004000_klyx_trust_latest_decision_enforcement.sql",
  "20260914121500_klyx_account_actor_capabilities.sql",
  "20260914183000_klyx_account_post_booking_incidents.sql",
  "20260914195500_klyx_provider_verification_account_capability_authority.sql",
  "20260915134000_klyx_provider_verification_compatibility_profile_guard.sql",
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
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --dry-run --include-all 2>&1 \\'
    );
    expect(workflow).toContain(
      'supabase db push --linked --dry-run --include-all 2>&1 \\'
    );
    expect(workflow).toContain(
      "Refusing production write: second dry-run batch differs from the audited reconciliation batch."
    );

    for (const migration of approvedReconciliationBatch) {
      expect(workflow).toContain(`"${migration}"`);
    }

    expect(workflow).toContain(
      'echo "SUPABASE_INCLUDE_ALL=true" >> "$GITHUB_ENV"'
    );
  });

  it("captures Supabase dry-run stderr in both audited proof files", () => {
    expect(workflow).toContain(
      '--dry-run --include-all 2>&1 \\\n              | tee migration-proof/dry-run-include-all.txt'
    );
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --dry-run 2>&1 | tee migration-proof/dry-run-after.txt'
    );
    expect(workflow).toContain(
      'supabase db push --linked --dry-run 2>&1 | tee migration-proof/dry-run-after.txt'
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
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --dry-run 2>&1 | tee migration-proof/dry-run-after.txt'
    );
    expect(workflow).toContain(
      'supabase db push --linked --dry-run 2>&1 | tee migration-proof/dry-run-after.txt'
    );
  });
});
