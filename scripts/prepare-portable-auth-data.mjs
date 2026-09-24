#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const [inputPath, targetTablesPath, outputPath, reportPath] = argv;
  if (!inputPath || !targetTablesPath || !outputPath || !reportPath) {
    fail(
      "Usage: prepare-portable-auth-data.mjs <auth-data.sql> <target-auth-tables.txt> <portable.sql> <report.json>"
    );
  }
  return { inputPath, targetTablesPath, outputPath, reportPath };
}

function normalizeTableName(raw) {
  const value = raw.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    fail(`Invalid target auth table name: ${JSON.stringify(value)}`);
  }
  return value;
}

function parseCopyHeader(line) {
  const match = /^COPY auth\.((?:"[^"]+")|(?:[a-zA-Z_][a-zA-Z0-9_]*))\s+\([^)]*\)\s+FROM stdin;\s*$/.exec(
    line
  );
  if (!match) return null;

  const identifier = match[1];
  if (identifier.startsWith('"')) {
    const unquoted = identifier.slice(1, -1).replace(/""/g, '"');
    return normalizeTableName(unquoted);
  }
  return normalizeTableName(identifier);
}

function isCopyTerminator(line) {
  return line === "\\.";
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export function preparePortableAuthData({ source, targetTables }) {
  const target = new Set(targetTables.map(normalizeTableName));
  if (!target.has("users")) {
    fail("Target Auth schema is missing required table auth.users");
  }

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  const omitted = [];
  const copied = [];
  let sawUsersCopy = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const table = parseCopyHeader(line);

    if (!table) {
      output.push(line);
      continue;
    }

    const block = [line];
    let rowCount = 0;
    let terminated = false;

    for (index += 1; index < lines.length; index += 1) {
      const dataLine = lines[index];
      block.push(dataLine);

      if (isCopyTerminator(dataLine)) {
        terminated = true;
        break;
      }

      rowCount += 1;
    }

    if (!terminated) {
      fail(`Unterminated COPY block for auth.${table}`);
    }

    if (table === "users") sawUsersCopy = true;

    if (target.has(table)) {
      copied.push({ table, rowCount });
      output.push(...block);
      continue;
    }

    if (rowCount !== 0) {
      fail(
        `Target Auth schema is missing auth.${table}, but source dump contains ${rowCount} data row(s)`
      );
    }

    omitted.push({
      table,
      rowCount,
      reason: "missing_in_target_auth_schema_and_empty_in_source_dump",
    });

    output.push(
      `-- KLYX DR: omitted empty COPY block for auth.${table}; relation is absent from isolated target Auth schema.`
    );
  }

  if (!sawUsersCopy) {
    fail("Source Auth dump does not contain required COPY block for auth.users");
  }

  return {
    sql: output.join("\n"),
    report: {
      format: "KLYX_PORTABLE_AUTH_DATA_REPORT",
      version: 1,
      copiedTableCount: copied.length,
      omittedTableCount: omitted.length,
      omitted,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = fs.readFileSync(args.inputPath, "utf8");
  const targetTables = fs
    .readFileSync(args.targetTablesPath, "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  const { sql, report } = preparePortableAuthData({ source, targetTables });

  ensureParent(args.outputPath);
  ensureParent(args.reportPath);
  fs.writeFileSync(args.outputPath, sql, { mode: 0o600 });
  fs.writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });

  process.stdout.write(
    `Portable Auth data prepared: copied=${report.copiedTableCount}, omitted_empty_missing=${report.omittedTableCount}\n`
  );
  for (const entry of report.omitted) {
    process.stdout.write(`Omitted empty missing target relation: auth.${entry.table}\n`);
  }
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
