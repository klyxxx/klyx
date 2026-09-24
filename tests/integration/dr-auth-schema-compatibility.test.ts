import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.join(
  process.cwd(),
  "scripts",
  "prepare-portable-auth-data.mjs"
);
const workflowPath = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "klyx-supabase-full-restore-drill.yml"
);
const tempRoots: string[] = [];

const usersCopy = [
  "COPY auth.users (id, email) FROM stdin;",
  "00000000-0000-0000-0000-000000000001\tuser@example.com",
  "\\.",
].join("\n");

const emptyRecoverySetsCopy = [
  "COPY auth.mfa_recovery_code_sets (id, user_id) FROM stdin;",
  "\\.",
].join("\n");

function runPortableAuth(input: { source: string; targetTables: string[] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "klyx-dr-auth-test-"));
  tempRoots.push(root);

  const sourcePath = path.join(root, "auth-data.sql");
  const targetPath = path.join(root, "target-auth-tables.txt");
  const outputPath = path.join(root, "auth-data.portable.sql");
  const reportPath = path.join(root, "report.json");

  fs.writeFileSync(sourcePath, input.source, "utf8");
  fs.writeFileSync(targetPath, `${input.targetTables.join("\n")}\n`, "utf8");

  const result = spawnSync(
    process.execPath,
    [scriptPath, sourcePath, targetPath, outputPath, reportPath],
    { encoding: "utf8" }
  );

  return {
    ...result,
    outputPath,
    reportPath,
    output: fs.existsSync(outputPath)
      ? fs.readFileSync(outputPath, "utf8")
      : null,
    report: fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
      : null,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("KLYX DR portable Auth data", () => {
  it("omits only missing target Auth relations whose COPY block is empty", () => {
    const result = runPortableAuth({
      source: [usersCopy, emptyRecoverySetsCopy, ""].join("\n"),
      targetTables: ["users", "identities"],
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain("COPY auth.users");
    expect(result.output).not.toContain("COPY auth.mfa_recovery_code_sets");
    expect(result.output).toContain(
      "omitted empty COPY block for auth.mfa_recovery_code_sets"
    );
    expect(result.report?.omitted).toEqual([
      {
        table: "mfa_recovery_code_sets",
        rowCount: 0,
        reason: "missing_in_target_auth_schema_and_empty_in_source_dump",
      },
    ]);
  });

  it("fails closed when a missing target relation contains source data", () => {
    const result = runPortableAuth({
      source: [
        usersCopy,
        "COPY auth.mfa_recovery_code_sets (id, user_id) FROM stdin;",
        "set-1\t00000000-0000-0000-0000-000000000001",
        "\\.",
        "",
      ].join("\n"),
      targetTables: ["users"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Target Auth schema is missing auth.mfa_recovery_code_sets, but source dump contains 1 data row(s)"
    );
    expect(result.output).toBeNull();
    expect(result.report).toBeNull();
  });

  it("requires auth.users in the target schema", () => {
    const result = runPortableAuth({
      source: usersCopy,
      targetTables: ["identities"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Target Auth schema is missing required table auth.users"
    );
  });

  it("requires auth.users in the source dump", () => {
    const result = runPortableAuth({
      source: emptyRecoverySetsCopy,
      targetTables: ["users", "mfa_recovery_code_sets"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Source Auth dump does not contain required COPY block for auth.users"
    );
  });

  it("rejects unterminated COPY blocks", () => {
    const result = runPortableAuth({
      source: [
        "COPY auth.users (id, email) FROM stdin;",
        "00000000-0000-0000-0000-000000000001\tuser@example.com",
      ].join("\n"),
      targetTables: ["users"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unterminated COPY block for auth.users");
  });

  it("keeps the full restore workflow fail-closed while using the portable Auth dump", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("Prepare target-aware Auth data snapshot");
    expect(workflow).toContain("prepare-portable-auth-data.mjs");
    expect(workflow).toContain("auth-data.portable.sql");
    expect(workflow).toContain("--variable ON_ERROR_STOP=1");
    expect(workflow).toContain("--file /tmp/klyx-full-dr/auth-data.portable.sql");
    expect(workflow).toContain("auth_schema_compatibility_verified=true");

    expect(workflow).not.toContain(
      "--file /tmp/klyx-full-dr/auth-data.sql"
    );
    expect(workflow).not.toContain("ON_ERROR_STOP=0");
  });
});
