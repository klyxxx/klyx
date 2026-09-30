import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/klyx-supabase-full-restore-drill.yml"),
  "utf8"
);
const prepare = fs.readFileSync(
  path.join(root, "scripts/prepare-klyx-auth-restore.mjs"),
  "utf8"
);

describe("full restore Auth schema drift contract", () => {
  it("prepares Auth data against the actual isolated target schema", () => {
    expect(workflow).toContain("Prepare portable Auth snapshot");
    expect(workflow).toContain("target-auth-schema.json");
    expect(workflow).toContain("information_schema.columns");
    expect(workflow).toContain("information_schema.sequences");
    expect(workflow).toContain("prepare-klyx-auth-restore.mjs");
    expect(workflow).toContain("auth-data.portable.sql");
  });

  it("never silently discards non-empty source Auth state", () => {
    expect(prepare).toContain(
      "KLYX_DR_AUTH_TARGET_TABLE_MISSING_WITH_DATA"
    );
    expect(prepare).toContain(
      "KLYX_DR_AUTH_TARGET_COLUMNS_MISSING_WITH_DATA"
    );
    expect(prepare).toContain("recoverableUserRowsSkipped: 0");
    expect(workflow).toContain(
      "Portable Auth restore would skip recoverable user data."
    );
  });

  it("preserves target-managed Auth schema migration state", () => {
    expect(prepare).toContain('"schema_migrations"');
    expect(prepare).toContain("targetManagedTables");
    expect(workflow).toContain(
      "auth_target_managed_schema_preserved=true"
    );
  });

  it("requires critical Auth continuity tables", () => {
    for (const table of [
      "users",
      "identities",
      "sessions",
      "refresh_tokens",
    ]) {
      expect(prepare).toContain(`"${table}"`);
    }
    expect(prepare).toContain(
      "KLYX_DR_AUTH_REQUIRED_TABLE_NOT_RESTORED"
    );
  });

  it("verifies exact row counts for every restored Auth table", () => {
    expect(workflow).toContain("source-auth-counts.txt");
    expect(workflow).toContain("target-auth-counts.txt");
    expect(workflow).toContain(
      "Restored Auth table row-count fingerprint mismatch."
    );
    expect(workflow).toContain(
      "auth_all_restored_table_row_counts_match=true"
    );
  });

  it("keeps source production read-only and target isolated", () => {
    expect(workflow).toContain("source=production_read_only_snapshot");
    expect(workflow).toContain("target=ephemeral_loopback_supabase");
    expect(workflow).toContain("production_write=false");
    expect(workflow).not.toContain("supabase link");
    expect(workflow).not.toContain("supabase db push");
  });
});
