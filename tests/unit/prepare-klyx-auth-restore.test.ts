import { describe, expect, it } from "vitest";

import { preparePortableAuthRestore } from "../../scripts/prepare-klyx-auth-restore.mjs";

const criticalTables = [
  "users",
  "identities",
  "sessions",
  "refresh_tokens",
];

function copy(table: string, rows: string[] = [], columns = ["id"]) {
  return [
    `COPY auth.${table} (${columns.join(", ")}) FROM stdin;`,
    ...rows,
    "\\.",
  ].join("\n");
}

function targetManifest(extraTables: Array<{ name: string; columns: string[] }> = []) {
  return {
    tables: [
      ...criticalTables.map((name) => ({ name, columns: ["id"] })),
      ...extraTables,
    ],
    sequences: [],
  };
}

function sourceWithCritical(extra = "") {
  return [
    copy("users", ["user-1"]),
    copy("identities", ["identity-1"]),
    copy("sessions", ["session-1"]),
    copy("refresh_tokens", ["token-1"]),
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

describe("portable KLYX Auth restore", () => {
  it("tolerates a source-only managed Auth table only when it is empty", () => {
    const result = preparePortableAuthRestore({
      sourceSql: sourceWithCritical(copy("mfa_recovery_code_sets")),
      targetManifest: targetManifest(),
    });

    expect(result.portableSql).not.toContain(
      "COPY auth.mfa_recovery_code_sets"
    );
    expect(result.report.skippedEmptyTables).toEqual([
      {
        table: "mfa_recovery_code_sets",
        reason: "target_table_missing",
      },
    ]);
    expect(result.report.recoverableUserRowsSkipped).toBe(0);
  });

  it("fails closed when a target-missing Auth table contains data", () => {
    expect(() =>
      preparePortableAuthRestore({
        sourceSql: sourceWithCritical(
          copy("future_auth_table", ["real-user-state"])
        ),
        targetManifest: targetManifest(),
      })
    ).toThrow(
      "KLYX_DR_AUTH_TARGET_TABLE_MISSING_WITH_DATA:future_auth_table:1"
    );
  });

  it("fails closed when target column drift would discard non-empty Auth data", () => {
    expect(() =>
      preparePortableAuthRestore({
        sourceSql: sourceWithCritical(
          copy("mfa_factors", ["factor-1\tsecret"], ["id", "secret"])
        ),
        targetManifest: targetManifest([
          { name: "mfa_factors", columns: ["id"] },
        ]),
      })
    ).toThrow(
      "KLYX_DR_AUTH_TARGET_COLUMNS_MISSING_WITH_DATA:mfa_factors:secret:1"
    );
  });

  it("keeps target Auth schema migrations instead of replaying production migration rows", () => {
    const result = preparePortableAuthRestore({
      sourceSql: sourceWithCritical(
        copy("schema_migrations", ["20260101", "20260202"])
      ),
      targetManifest: targetManifest([
        { name: "schema_migrations", columns: ["version"] },
      ]),
    });

    expect(result.portableSql).not.toContain("COPY auth.schema_migrations");
    expect(result.report.targetManagedTables).toEqual([
      { table: "schema_migrations", rowCount: 2 },
    ]);
    expect(result.report.recoverableUserRowsSkipped).toBe(0);
  });

  it("requires all critical Auth continuity tables in source and target", () => {
    const sourceMissingSessions = [
      copy("users", ["user-1"]),
      copy("identities", ["identity-1"]),
      copy("refresh_tokens", ["token-1"]),
    ].join("\n");

    expect(() =>
      preparePortableAuthRestore({
        sourceSql: sourceMissingSessions,
        targetManifest: targetManifest(),
      })
    ).toThrow("KLYX_DR_AUTH_REQUIRED_SOURCE_TABLE_MISSING:sessions");
  });

  it("emits exact expected row counts and an isolated-target reset plan", () => {
    const result = preparePortableAuthRestore({
      sourceSql: sourceWithCritical(
        copy("mfa_amr_claims", ["claim-1", "claim-2"])
      ),
      targetManifest: targetManifest([
        { name: "mfa_amr_claims", columns: ["id"] },
      ]),
    });

    expect(result.expectedCounts).toContain("users|1");
    expect(result.expectedCounts).toContain("mfa_amr_claims|2");
    expect(result.resetSql).toContain("TRUNCATE TABLE");
    expect(result.resetSql).toContain('auth."users"');
    expect(result.resetSql).not.toContain("schema_migrations");
  });
});
