import fs from "node:fs";

const REQUIRED_AUTH_TABLES = [
  "users",
  "identities",
  "sessions",
  "refresh_tokens",
];

const TARGET_MANAGED_TABLES = new Set([
  "schema_migrations",
]);

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function normalizeIdentifier(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }
  return trimmed;
}

function parseColumns(raw) {
  const columns = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char === '"') {
      if (quoted && raw[index + 1] === '"') {
        current += '""';
        index += 1;
        continue;
      }
      quoted = !quoted;
      current += char;
      continue;
    }

    if (char === "," && !quoted) {
      columns.push(normalizeIdentifier(current));
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) columns.push(normalizeIdentifier(current));
  return columns;
}

function parseCopyHeader(line) {
  const match = /^COPY auth\.("(?:[^"]|"")*"|[A-Za-z0-9_]+) \((.*)\) FROM stdin;$/.exec(
    line
  );
  if (!match) return null;

  return {
    table: normalizeIdentifier(match[1]),
    columns: parseColumns(match[2]),
  };
}

function targetSchemaMap(manifest) {
  if (!manifest || !Array.isArray(manifest.tables)) {
    fail("KLYX_DR_AUTH_TARGET_MANIFEST_INVALID");
  }

  const tables = new Map();
  for (const entry of manifest.tables) {
    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    const columns = Array.isArray(entry?.columns)
      ? entry.columns.filter((column) => typeof column === "string")
      : [];

    if (!name || columns.length === 0) {
      fail("KLYX_DR_AUTH_TARGET_MANIFEST_INVALID", name || "table");
    }

    tables.set(name, new Set(columns));
  }

  const sequences = new Set(
    Array.isArray(manifest.sequences)
      ? manifest.sequences.filter((name) => typeof name === "string")
      : []
  );

  return { tables, sequences };
}

export function preparePortableAuthRestore({ sourceSql, targetManifest }) {
  const { tables: targetTables, sequences: targetSequences } =
    targetSchemaMap(targetManifest);
  const lines = sourceSql.replaceAll("\r\n", "\n").split("\n");
  const output = [];
  const restoredTables = [];
  const skippedEmptyTables = [];
  const targetManagedTables = [];
  const skippedSequences = [];
  const sourceTables = new Set();
  const restoredNames = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const copy = parseCopyHeader(line);

    if (!copy) {
      const sequenceMatch = /pg_catalog\.setval\('auth\.([^']+)'::regclass/.exec(
        line
      );

      if (sequenceMatch && !targetSequences.has(sequenceMatch[1])) {
        skippedSequences.push(sequenceMatch[1]);
        output.push(
          `-- KLYX DR omitted target-missing Auth sequence ${sequenceMatch[1]}.`
        );
      } else {
        output.push(line);
      }
      continue;
    }

    sourceTables.add(copy.table);

    const block = [line];
    const dataLines = [];
    let terminated = false;

    while (index + 1 < lines.length) {
      index += 1;
      const blockLine = lines[index];
      block.push(blockLine);

      if (blockLine === "\\.") {
        terminated = true;
        break;
      }

      dataLines.push(blockLine);
    }

    if (!terminated) {
      fail("KLYX_DR_AUTH_COPY_BLOCK_UNTERMINATED", copy.table);
    }

    const rowCount = dataLines.length;

    if (TARGET_MANAGED_TABLES.has(copy.table)) {
      targetManagedTables.push({ table: copy.table, rowCount });
      output.push(
        `-- KLYX DR preserved target-managed auth.${copy.table} (${rowCount} source rows not replayed).`
      );
      continue;
    }

    const targetColumns = targetTables.get(copy.table);
    if (!targetColumns) {
      if (rowCount > 0) {
        fail(
          "KLYX_DR_AUTH_TARGET_TABLE_MISSING_WITH_DATA",
          `${copy.table}:${rowCount}`
        );
      }

      skippedEmptyTables.push({
        table: copy.table,
        reason: "target_table_missing",
      });
      output.push(
        `-- KLYX DR omitted empty source-only auth.${copy.table}.`
      );
      continue;
    }

    const missingColumns = copy.columns.filter(
      (column) => !targetColumns.has(column)
    );

    if (missingColumns.length > 0) {
      if (rowCount > 0) {
        fail(
          "KLYX_DR_AUTH_TARGET_COLUMNS_MISSING_WITH_DATA",
          `${copy.table}:${missingColumns.join(",")}:${rowCount}`
        );
      }

      skippedEmptyTables.push({
        table: copy.table,
        reason: "target_columns_missing",
        missingColumns,
      });
      output.push(
        `-- KLYX DR omitted empty auth.${copy.table} because target columns differ.`
      );
      continue;
    }

    output.push(...block);
    restoredNames.add(copy.table);
    restoredTables.push({
      table: copy.table,
      rowCount,
      columns: copy.columns,
    });
  }

  for (const table of REQUIRED_AUTH_TABLES) {
    if (!sourceTables.has(table)) {
      fail("KLYX_DR_AUTH_REQUIRED_SOURCE_TABLE_MISSING", table);
    }
    if (!targetTables.has(table)) {
      fail("KLYX_DR_AUTH_REQUIRED_TARGET_TABLE_MISSING", table);
    }
    if (!restoredNames.has(table)) {
      fail("KLYX_DR_AUTH_REQUIRED_TABLE_NOT_RESTORED", table);
    }
  }

  if (restoredTables.length === 0) {
    fail("KLYX_DR_AUTH_NO_RESTORABLE_TABLES");
  }

  const resetTargets = restoredTables
    .map(({ table }) => `auth.${JSON.stringify(table)}`)
    .join(", ");

  const resetSql = [
    "-- KLYX DR: ephemeral target only.",
    `TRUNCATE TABLE ${resetTargets} RESTART IDENTITY CASCADE;`,
    "",
  ].join("\n");

  const expectedCounts = restoredTables
    .map(({ table, rowCount }) => `${table}|${rowCount}`)
    .sort()
    .join("\n");

  const report = {
    format: "KLYX_PORTABLE_AUTH_RESTORE_PLAN",
    version: 1,
    requiredTables: REQUIRED_AUTH_TABLES,
    restoredTables,
    skippedEmptyTables,
    targetManagedTables,
    skippedSequences: [...new Set(skippedSequences)].sort(),
    recoverableUserRowsSkipped: 0,
  };

  return {
    portableSql: `${output.join("\n")}\n`,
    resetSql,
    expectedCounts: `${expectedCounts}\n`,
    report,
  };
}

function main() {
  const [
    sourcePath,
    targetManifestPath,
    portablePath,
    resetPath,
    reportPath,
    expectedCountsPath,
  ] = process.argv.slice(2);

  if (
    !sourcePath ||
    !targetManifestPath ||
    !portablePath ||
    !resetPath ||
    !reportPath ||
    !expectedCountsPath
  ) {
    fail("KLYX_DR_AUTH_PREPARE_ARGUMENTS_INVALID");
  }

  const sourceSql = fs.readFileSync(sourcePath, "utf8");
  const targetManifest = JSON.parse(
    fs.readFileSync(targetManifestPath, "utf8")
  );
  const result = preparePortableAuthRestore({
    sourceSql,
    targetManifest,
  });

  fs.writeFileSync(portablePath, result.portableSql, { mode: 0o600 });
  fs.writeFileSync(resetPath, result.resetSql, { mode: 0o600 });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(result.report, null, 2)}\n`,
    { mode: 0o600 }
  );
  fs.writeFileSync(expectedCountsPath, result.expectedCounts, {
    mode: 0o600,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
