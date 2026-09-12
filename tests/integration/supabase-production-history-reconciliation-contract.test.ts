import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const preflightPath =
  "supabase/migrations/20260906083500_klyx_profiles_stripe_index_history_preflight.sql";
const cleanupPath =
  "supabase/migrations/20260906084000_klyx_profiles_stripe_duplicate_index_cleanup.sql";
const orphanPath =
  "supabase/migrations/20260906140329_klyx_remove_duplicate_profiles_stripe_index.sql";
const accountFoundationPath =
  "supabase/migrations/20260912190000_klyx_unique_account_foundation.sql";
const reconciliationPath =
  "supabase/migrations/20260913001700_klyx_profiles_stripe_unique_index_reconciliation.sql";
const workflowPath =
  ".github/workflows/klyx-supabase-production-migrations.yml";

const preflight = read(preflightPath);
const cleanup = read(cleanupPath);
const orphan = read(orphanPath);
const reconciliation = read(reconciliationPath);
const workflow = read(workflowPath);

function executableSql(sql: string) {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();
}

function bashArray(name: string) {
  const match = workflow.match(
    new RegExp(`${name}=\\((.*?)\\n\\s*\\)`, "s")
  );

  if (!match) return [];

  return [...match[1].matchAll(/"([0-9]{14}_[^"]+\.sql)"/g)].map(
    (entry) => entry[1]
  );
}

describe("Supabase production migration-history reconciliation contract", () => {
  it("restores the exact remote-only migration version without hiding its historical effect", () => {
    expect(orphanPath).toContain("20260906140329");
    expect(executableSql(orphan)).toBe(
      "drop index if exists public.profiles_stripe_account_id_unique;"
    );
  });

  it("prepares both equivalent Stripe indexes before the immutable historical cleanup", () => {
    expect(preflightPath.localeCompare(cleanupPath)).toBeLessThan(0);
    expect(preflight).toContain(
      "create unique index if not exists profiles_stripe_account_id_key"
    );
    expect(preflight).toContain(
      "create unique index if not exists profiles_stripe_account_id_unique"
    );
    expect(preflight).toContain(
      "KLYX_PROFILES_STRIPE_HISTORY_PREFLIGHT_INDEX_DRIFT"
    );
    expect(preflight).toContain(
      "legacy.indkey::text <> stripe_attnum::text"
    );
    expect(preflight).toContain(
      "canonical.indkey::text <> stripe_attnum::text"
    );
    expect(preflight).not.toContain("indkey::smallint[]");
    expect(executableSql(preflight)).not.toMatch(/drop\s+index/i);

    expect(cleanup).toContain(
      "drop index public.profiles_stripe_account_id_key;"
    );
    expect(cleanup).toContain("KLYX_PROFILES_STRIPE_INDEX_DRIFT");
  });

  it("normalizes fresh databases and production back to one canonical Stripe uniqueness index", () => {
    expect(reconciliationPath.localeCompare(accountFoundationPath)).toBeGreaterThan(0);
    expect(reconciliation).toContain(
      "create unique index if not exists profiles_stripe_account_id_unique"
    );
    expect(reconciliation).toContain(
      "canonical.indkey::text = stripe_attnum::text"
    );
    expect(reconciliation).not.toContain("indkey::smallint[]");
    expect(reconciliation).toContain(
      "KLYX_PROFILES_STRIPE_RECONCILIATION_CANONICAL_DRIFT"
    );
    expect(reconciliation).toContain(
      "KLYX_PROFILES_STRIPE_RECONCILIATION_LEGACY_DRIFT"
    );
    expect(reconciliation.indexOf("KLYX_PROFILES_STRIPE_RECONCILIATION_LEGACY_DRIFT"))
      .toBeLessThan(
        reconciliation.indexOf("drop index public.profiles_stripe_account_id_key")
      );
  });

  it("allows include-all only for the exact audited historical production gap", () => {
    const approvedHistorical = bashArray("approved_historical_migrations");

    expect(approvedHistorical).toEqual([
      "20260905235000_klyx_activity_hidden_missions.sql",
      "20260905235500_klyx_core_payment_rpc_execution_sentinel.sql",
      "20260906000500_klyx_handle_new_user_search_path.sql",
      "20260906081500_klyx_remaining_rls_initplan_optimization.sql",
      "20260906083000_klyx_public_availability_rpc_hardening.sql",
      "20260906083500_klyx_profiles_stripe_index_history_preflight.sql",
      "20260906084000_klyx_profiles_stripe_duplicate_index_cleanup.sql",
      "20260906084500_klyx_message_notification_fk_indexes.sql",
    ]);

    expect(workflow).toContain(
      "Refusing --include-all: historical migration set differs from the audited production gap."
    );
    expect(workflow).not.toContain("supabase migration repair");
  });

  it("pins the exact second dry-run batch before any production write", () => {
    const approvedBatch = bashArray("approved_reconciliation_batch");

    expect(approvedBatch).toEqual([
      "20260905235000_klyx_activity_hidden_missions.sql",
      "20260905235500_klyx_core_payment_rpc_execution_sentinel.sql",
      "20260906000500_klyx_handle_new_user_search_path.sql",
      "20260906081500_klyx_remaining_rls_initplan_optimization.sql",
      "20260906083000_klyx_public_availability_rpc_hardening.sql",
      "20260906083500_klyx_profiles_stripe_index_history_preflight.sql",
      "20260906084000_klyx_profiles_stripe_duplicate_index_cleanup.sql",
      "20260906084500_klyx_message_notification_fk_indexes.sql",
      "20260907232000_klyx_brain_multislot_atomic_publication.sql",
      "20260909161000_klyx_sumsub_webhook_retry_lease.sql",
      "20260909181000_klyx_booking_status_history_atomicity.sql",
      "20260909214500_klyx_booking_payment_cancel_race_guard.sql",
      "20260911151000_klyx_group_refund_transaction_guard.sql",
      "20260911160000_klyx_individual_refund_route_webhook_guard.sql",
      "20260912133000_klyx_provider_legal_authority.sql",
      "20260912190000_klyx_unique_account_foundation.sql",
      "20260912233000_klyx_trust_safety_legal_foundation.sql",
      "20260912234000_klyx_trust_legal_assessments.sql",
      "20260912235000_klyx_trust_mission_enforcement.sql",
      "20260913001700_klyx_profiles_stripe_unique_index_reconciliation.sql",
    ]);

    expect(approvedBatch).not.toContain(
      "20260906140329_klyx_remove_duplicate_profiles_stripe_index.sql"
    );
    expect(workflow).toContain(
      "Refusing production write: second dry-run batch differs from the audited reconciliation batch."
    );
    expect(workflow.indexOf("dry-run --include-all")).toBeLessThan(
      workflow.indexOf("- name: Apply pending production migrations")
    );
  });
});
