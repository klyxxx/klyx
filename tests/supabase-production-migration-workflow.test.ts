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

// Snapshot pinned to the production migration state observed before LIVE enablement.
const approvedHistoricalMigrations = [
  "20260914190000_klyx_account_stripe_connect_identity.sql",
  "20260915110000_klyx_account_risk_engine.sql",
  "20260915113000_klyx_transaction_risk_gate.sql",
];

const approvedReconciliationBatch = [
  "20260914190000_klyx_account_stripe_connect_identity.sql",
  "20260915110000_klyx_account_risk_engine.sql",
  "20260915113000_klyx_transaction_risk_gate.sql",
  "20260915170000_klyx_booking_settlement_control.sql",
  "20260915173000_klyx_refund_transaction_risk_gate.sql",
  "20260915194500_klyx_platform_held_settlement_test.sql",
  "20260915200500_klyx_platform_held_settlement_fail_closed.sql",
  "20260916140000_klyx_platform_held_legacy_null_guard.sql",
  "20260918130000_klyx_settlement_claim_sql_qualification.sql",
  "20260918183500_klyx_settlement_recovery_reconciliation.sql",
  "20260918211000_klyx_platform_held_group_multiexecutor_test.sql",
  "20260918213000_klyx_platform_held_group_refund_hardening.sql",
  "20260919190000_klyx_group_release_after_refund_hardening.sql",
];

describe("Supabase production migration historical-gap recovery", () => {
  it("pins recovery to the exact audited KLYX historical migration set", () => {
    expect(workflow).toContain("approved_historical_migrations=(");

    expect(approvedHistoricalMigrations).toHaveLength(3);

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

    expect(approvedReconciliationBatch).toHaveLength(13);

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
