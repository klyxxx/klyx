import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(
  path.join(
    process.cwd(),
    ".github/workflows/klyx-supabase-full-restore-drill.yml"
  ),
  "utf8"
);

describe("KLYX full restore Auth schema parity", () => {
  it("captures production Auth schema and data separately", () => {
    expect(workflow).toContain(
      '-f "$KLYX_FULL_DR_DB_ROOT/auth-schema.sql" --schema auth'
    );
    expect(workflow).toContain(
      '-f "$KLYX_FULL_DR_DB_ROOT/auth-data.sql" --schema auth --data-only --use-copy'
    );
  });

  it("restores source Auth schema before public schema and data", () => {
    const restore = workflow.slice(
      workflow.indexOf(
        "- name: Restore source Auth schema, database and Auth data into isolated database"
      ),
      workflow.indexOf("- name: Verify every restored Auth-table row count")
    );

    expect(restore).toContain("drop schema if exists auth cascade");
    expect(restore).toContain("/tmp/klyx-full-dr/auth-schema.sql");
    expect(restore).toContain("/tmp/klyx-full-dr/auth-data.sql");

    expect(restore.indexOf("auth-schema.sql")).toBeLessThan(
      restore.indexOf("public-schema.sql")
    );
    expect(restore.indexOf("auth-schema.sql")).toBeLessThan(
      restore.indexOf("auth-data.sql")
    );
  });

  it("compares every Auth table instead of filtering unknown production tables", () => {
    expect(workflow).toContain(
      'where schemaname = \'${schema}\' order by tablename'
    );
    expect(workflow).toContain("source-auth-tables.txt");
    expect(workflow).toContain("source-auth-counts.txt");
    expect(workflow).toContain("target-auth-counts.txt");
    expect(workflow).toContain("Restored Auth-table row-count fingerprint mismatch.");
    expect(workflow).toContain("all_auth_table_row_counts_match=true");
    expect(workflow).toContain("auth_source_schema_restored=true");

    expect(workflow).not.toContain("mfa_recovery_code_sets.*skip");
    expect(workflow).not.toContain("grep -v.*mfa_recovery_code_sets");
  });

  it("still verifies Auth through the restored local GoTrue service", () => {
    expect(workflow).toContain(
      'node scripts/restore-klyx-storage.mjs "$KLYX_FULL_DR_STORAGE_ROOT"'
    );
    expect(workflow).toContain("auth_service_verified=true");
  });

  it("keeps production source read-only", () => {
    for (const forbidden of [
      "supabase link",
      "supabase db push",
      "stripe.transfers.create(",
      "stripe.refunds.create(",
    ]) {
      expect(workflow).not.toContain(forbidden);
    }
  });
});
