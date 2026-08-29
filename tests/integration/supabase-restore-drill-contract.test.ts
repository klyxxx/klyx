import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflowPath = path.join(
  process.cwd(),
  ".github/workflows/klyx-supabase-restore-drill.yml"
);
const workflow = fs
  .readFileSync(workflowPath, "utf8")
  .replace(/\r\n/g, "\n");

describe("KLYX Supabase restore drill safety contract", () => {
  it("is manual-only and fail-closed behind explicit production-read confirmation", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toContain("push:");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).toContain("confirm_production_read");
    expect(workflow).toContain(
      'if [ "$CONFIRM_PRODUCTION_READ" != "true" ]'
    );
  });

  it("validates the production source and a loopback-only restore target", () => {
    expect(workflow).toContain("SUPABASE_DB_URL");
    expect(workflow).toContain(".supabase.co");
    expect(workflow).toContain(".pooler.supabase.com");
    expect(workflow).toContain("Production source database must not be loopback.");
    expect(workflow).toContain('KLYX_RESTORE_DRILL_TARGET_DB_URL=$DB_URL');
    expect(workflow).toContain('if [ "$local_host" != "127.0.0.1" ]');
    expect(workflow).toContain('supabase stop --no-backup || true');
  });

  it("dumps roles plus public-only schema and data", () => {
    expect(workflow).toContain("supabase db dump");
    expect(workflow).toContain("--role-only");
    expect(workflow).toContain('roles.sql"');
    expect(workflow).toContain('schema.sql"');
    expect(workflow).toContain('data.sql"');
    expect(workflow).toContain("--use-copy");
    expect(workflow).toContain("--data-only");
    expect((workflow.match(/--schema public/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(workflow).toContain(
      "Public-only data dump unexpectedly contains managed Supabase schema rows."
    );
    expect(workflow).toContain("^COPY (auth|storage)\\.");
    expect(workflow).toContain("managed_schema_rows_replayed=false");
  });

  it("replays portable role definitions or safely keeps local roles for GUC-only dumps", () => {
    expect(workflow).toContain("Prepare portable role dump");
    expect(workflow).toContain("roles.portable.sql");
    expect(workflow).toContain("(?:SET|RESET)\\b");
    expect(workflow).toContain("const roleStatement =");
    expect(workflow).toContain("const hasPortableRoleStatements =");
    expect(workflow).toContain(
      "no portable role definitions were present"
    );
    expect(workflow).toContain(
      "existing local Supabase roles are retained"
    );
    expect(workflow).toContain(
      "role_replay_mode=portable_definitions_or_existing_local_roles"
    );
    expect(workflow).toContain("role_guc_defaults_replayed=false");
    expect(workflow).toContain("scope=public_schema_data_portable_roles");
    expect(workflow).toContain('--file "$dump_dir/roles.portable.sql"');
    expect(workflow).not.toContain(
      "Portable role dump lost all role definitions."
    );
    expect(workflow).not.toContain("ON_ERROR_STOP=0");
  });

  it("restores only after clearing public on the ephemeral target and disables triggers during data load", () => {
    expect(workflow).toContain("drop schema if exists public cascade;");
    expect(workflow).toContain("create schema public authorization postgres;");
    expect(workflow).toContain(
      "alter default privileges in schema public revoke all on tables from anon, authenticated;"
    );
    expect(workflow).toContain("--single-transaction");
    expect(workflow).toContain("--variable ON_ERROR_STOP=1");
    expect(workflow).toContain("SET session_replication_role = replica");
  });

  it("proves critical KLYX public tables by private row-count fingerprints", () => {
    for (const table of [
      "profiles",
      "services",
      "bookings",
      "booking_financial_ledger",
      "booking_groups",
      "service_quotes",
    ]) {
      expect(workflow).toContain(table);
    }

    expect(workflow).toContain("source_count=");
    expect(workflow).toContain("target_count=");
    expect(workflow).toContain("critical_table_fingerprints_match=true");
    expect(workflow).not.toContain("echo \"$source_count\"");
    expect(workflow).not.toContain("echo \"$target_count\"");
  });

  it("never uploads the sensitive SQL dumps or private fingerprints", () => {
    expect(workflow).toContain("path: restore-proof/");
    expect(workflow).toContain("sensitive_dump_uploaded=false");
    expect(workflow).toContain("auth_storage_objects_claimed=false");

    const uploadSection = workflow.slice(
      workflow.indexOf("- name: Upload sanitized restore proof"),
      workflow.indexOf("- name: Destroy sensitive restore material")
    );

    expect(uploadSection).not.toContain("roles.sql");
    expect(uploadSection).not.toContain("roles.portable.sql");
    expect(uploadSection).not.toContain("schema.sql");
    expect(uploadSection).not.toContain("data.sql");
    expect(uploadSection).not.toContain("KLYX_RESTORE_DRILL_DUMP_DIR");
    expect(uploadSection).not.toContain("KLYX_RESTORE_DRILL_FINGERPRINT_DIR");
    expect(workflow).toContain('rm -rf -- "$path"');
  });
});
