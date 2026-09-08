import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const EXPORTER = path.join(ROOT, "scripts", "i18n", "export-tolgee-seed.mjs");
const DEFAULT_CATALOG_DIR = path.join(ROOT, "messages", "tolgee");

function parseArgs(argv) {
  const options = {
    catalogDir: DEFAULT_CATALOG_DIR,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--json") {
      options.json = true;
      continue;
    }

    if (value === "--catalog-dir") {
      const next = argv[index + 1];
      if (!next) throw new Error("--catalog-dir requires a path");
      options.catalogDir = path.resolve(ROOT, next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

function assertStringRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label}.${key} must be a non-empty string`);
    }
  }

  return value;
}

async function readCatalog(filePath, label) {
  const raw = await fs.readFile(filePath, "utf8");
  return assertStringRecord(JSON.parse(raw), label);
}

function generateSeed(outputDir) {
  const raw = execFileSync(
    process.execPath,
    [EXPORTER, "--output-dir", outputDir, "--json"],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  );

  return JSON.parse(raw.trim());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedDir = await fs.mkdtemp(
    path.join(tmpdir(), "klyx-tolgee-catalog-check-")
  );

  try {
    const seed = generateSeed(generatedDir);
    const managedSet = new Set(seed.managedLocales);
    const requiredLocales = [
      ...seed.publishedLocales,
      ...(managedSet.has("es") ? ["es"] : []),
    ].filter((locale, index, locales) => locales.indexOf(locale) === index);

    const entries = await fs.readdir(options.catalogDir, { withFileTypes: true });
    const trackedLocales = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -5))
      .sort((left, right) => left.localeCompare(right, "en"));
    const trackedSet = new Set(trackedLocales);

    for (const locale of requiredLocales) {
      if (!trackedSet.has(locale)) {
        throw new Error(`Missing required Tolgee catalog: ${locale}.json`);
      }
    }

    for (const locale of trackedLocales) {
      if (!managedSet.has(locale)) {
        throw new Error(`Unknown Tolgee catalog locale: ${locale}`);
      }

      const committed = await readCatalog(
        path.join(options.catalogDir, `${locale}.json`),
        `${locale}.json`
      );
      const generated = await readCatalog(
        path.join(generatedDir, `${locale}.json`),
        `generated ${locale}.json`
      );

      for (const key of Object.keys(generated)) {
        if (typeof committed[key] !== "string" || committed[key].length === 0) {
          throw new Error(`Missing Tolgee seed key in ${locale}.json: ${key}`);
        }
      }
    }

    const summary = {
      trackedLocales,
      trackedCatalogCount: trackedLocales.length,
      requiredLocales,
      managedLocaleCount: seed.managedLocales.length,
      keyCountPerCatalog: seed.keyCountPerCatalog,
    };

    if (options.json) {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      return;
    }

    process.stdout.write(
      [
        "Tolgee committed catalogs validated.",
        `Tracked: ${summary.trackedLocales.join(", ")}`,
        `Managed by seed: ${summary.managedLocaleCount}`,
        `Keys/catalog: ${summary.keyCountPerCatalog}`,
      ].join("\n") + "\n"
    );
  } finally {
    await fs.rm(generatedDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
