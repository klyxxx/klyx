import { describe, expect, it } from "vitest";

import { preparePortableAuthData } from "../../scripts/prepare-portable-auth-data.mjs";

const usersCopy = [
  "COPY auth.users (id, email) FROM stdin;",
  "00000000-0000-0000-0000-000000000001\tuser@example.com",
  "\\.",
].join("\n");

const emptyRecoverySetsCopy = [
  "COPY auth.mfa_recovery_code_sets (id, user_id) FROM stdin;",
  "\\.",
].join("\n");

describe("KLYX DR portable Auth data", () => {
  it("omits only missing target Auth relations whose COPY block is empty", () => {
    const source = [usersCopy, emptyRecoverySetsCopy, ""].join("\n");
    const result = preparePortableAuthData({
      source,
      targetTables: ["users", "identities"],
    });

    expect(result.sql).toContain("COPY auth.users");
    expect(result.sql).not.toContain("COPY auth.mfa_recovery_code_sets");
    expect(result.sql).toContain(
      "omitted empty COPY block for auth.mfa_recovery_code_sets"
    );
    expect(result.report.omitted).toEqual([
      {
        table: "mfa_recovery_code_sets",
        rowCount: 0,
        reason: "missing_in_target_auth_schema_and_empty_in_source_dump",
      },
    ]);
  });

  it("fails closed when a missing target relation contains source data", () => {
    const source = [
      usersCopy,
      "COPY auth.mfa_recovery_code_sets (id, user_id) FROM stdin;",
      "set-1\t00000000-0000-0000-0000-000000000001",
      "\\.",
      "",
    ].join("\n");

    expect(() =>
      preparePortableAuthData({
        source,
        targetTables: ["users"],
      })
    ).toThrow(
      "Target Auth schema is missing auth.mfa_recovery_code_sets, but source dump contains 1 data row(s)"
    );
  });

  it("requires auth.users in both target schema and source dump", () => {
    expect(() =>
      preparePortableAuthData({
        source: usersCopy,
        targetTables: ["identities"],
      })
    ).toThrow("Target Auth schema is missing required table auth.users");

    expect(() =>
      preparePortableAuthData({
        source: emptyRecoverySetsCopy,
        targetTables: ["users", "mfa_recovery_code_sets"],
      })
    ).toThrow("Source Auth dump does not contain required COPY block for auth.users");
  });

  it("rejects malformed or unterminated COPY blocks", () => {
    expect(() =>
      preparePortableAuthData({
        source: [
          "COPY auth.users (id, email) FROM stdin;",
          "00000000-0000-0000-0000-000000000001\tuser@example.com",
        ].join("\n"),
        targetTables: ["users"],
      })
    ).toThrow("Unterminated COPY block for auth.users");
  });
});
