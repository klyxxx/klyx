import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "lib");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "messages", "tolgee");
const BATCH_FILE_PATTERN = /^klyx-i18n-batch-(\d+)\.ts$/;
const BATCH_CONSTANT_PATTERN =
  /^KLYX_BATCH_(\d+)_(LANGUAGE_OPTIONS|UI_MESSAGES|NAVIGATION_TRANSLATIONS)$/;

function parseArgs(argv) {
  const options = {
    check: false,
    json: false,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--check") {
      options.check = true;
      continue;
    }

    if (value === "--json") {
      options.json = true;
      continue;
    }

    if (value === "--output-dir") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--output-dir requires a path");
      }
      options.outputDir = path.resolve(ROOT, next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

function unwrapExpression(node) {
  let current = node;

  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function resolvePropertyName(node) {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  throw new Error(`Unsupported object key syntax: ${node.getText()}`);
}

function evaluateExpression(input, environment) {
  const node = unwrapExpression(input);

  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;

  if (ts.isPrefixUnaryExpression(node)) {
    const value = evaluateExpression(node.operand, environment);
    if (typeof value !== "number") {
      throw new Error(`Unsupported unary operand: ${node.getText()}`);
    }
    if (node.operator === ts.SyntaxKind.MinusToken) return -value;
    if (node.operator === ts.SyntaxKind.PlusToken) return value;
    throw new Error(`Unsupported unary operator: ${node.getText()}`);
  }

  if (ts.isIdentifier(node)) {
    if (!environment.has(node.text)) {
      throw new Error(`Unknown constant reference: ${node.text}`);
    }
    return environment.get(node.text);
  }

  if (ts.isArrayLiteralExpression(node)) {
    const result = [];

    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = evaluateExpression(element.expression, environment);
        if (!Array.isArray(spread)) {
          throw new Error(`Array spread is not an array: ${element.getText()}`);
        }
        result.push(...spread);
      } else {
        result.push(evaluateExpression(element, environment));
      }
    }

    return result;
  }

  if (ts.isObjectLiteralExpression(node)) {
    const result = {};

    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = evaluateExpression(property.expression, environment);
        if (!spread || typeof spread !== "object" || Array.isArray(spread)) {
          throw new Error(`Object spread is not an object: ${property.getText()}`);
        }
        Object.assign(result, spread);
        continue;
      }

      if (ts.isPropertyAssignment(property)) {
        result[resolvePropertyName(property.name)] = evaluateExpression(
          property.initializer,
          environment
        );
        continue;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        result[property.name.text] = evaluateExpression(
          property.name,
          environment
        );
        continue;
      }

      throw new Error(`Unsupported object property: ${property.getText()}`);
    }

    return result;
  }

  throw new Error(`Unsupported translation expression: ${node.getText()}`);
}

async function loadConstants(filePath, environment, shouldLoad) {
  const sourceText = await fs.readFile(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer ||
        !shouldLoad(declaration.name.text)
      ) {
        continue;
      }

      const value = evaluateExpression(declaration.initializer, environment);
      environment.set(declaration.name.text, value);
    }
  }
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      left.localeCompare(right, "en")
    )
  );
}

function assertStringRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label}.${key} must be a non-empty string`);
    }
  }

  return value;
}

async function readExistingCatalog(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return assertStringRecord(parsed, path.basename(filePath));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function buildSeed() {
  const entries = await fs.readdir(LIB_DIR);
  const batchFiles = entries
    .map((name) => {
      const match = name.match(BATCH_FILE_PATTERN);
      return match ? { name, batch: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.batch - right.batch);

  if (batchFiles.length === 0) {
    throw new Error("No KLYX i18n batch files found");
  }

  const environment = new Map();

  for (const { name } of batchFiles) {
    await loadConstants(
      path.join(LIB_DIR, name),
      environment,
      (constantName) =>
        BATCH_CONSTANT_PATTERN.test(constantName) ||
        constantName === "KLYX_EN_NAVIGATION_TRANSLATIONS"
    );
  }

  await loadConstants(
    path.join(LIB_DIR, "klyx-i18n.ts"),
    environment,
    (constantName) => constantName === "KLYX_FULLY_TRANSLATED_LOCALES"
  );

  const languageOptions = [];
  const uiByLocale = {};
  const navigationByLocale = {};

  for (const { batch } of batchFiles) {
    const options = environment.get(`KLYX_BATCH_${batch}_LANGUAGE_OPTIONS`);
    const ui = environment.get(`KLYX_BATCH_${batch}_UI_MESSAGES`);
    const navigation = environment.get(
      `KLYX_BATCH_${batch}_NAVIGATION_TRANSLATIONS`
    );

    if (!Array.isArray(options)) {
      throw new Error(`Missing language options for batch ${batch}`);
    }
    if (!ui || typeof ui !== "object") {
      throw new Error(`Missing UI messages for batch ${batch}`);
    }
    if (!navigation || typeof navigation !== "object") {
      throw new Error(`Missing navigation translations for batch ${batch}`);
    }

    languageOptions.push(...options);
    Object.assign(uiByLocale, ui);
    Object.assign(navigationByLocale, navigation);
  }

  const managedLocales = languageOptions.map((option) => option.value);
  const uniqueLocales = new Set(managedLocales);

  if (managedLocales.length !== uniqueLocales.size) {
    throw new Error("KLYX registered locale list contains duplicates");
  }

  const publishedLocales = environment.get("KLYX_FULLY_TRANSLATED_LOCALES");
  if (!Array.isArray(publishedLocales)) {
    throw new Error("KLYX fully translated locale policy could not be read");
  }

  for (const locale of publishedLocales) {
    if (!uniqueLocales.has(locale)) {
      throw new Error(`Published locale is not registered: ${locale}`);
    }
  }

  const uiKeys = new Set();
  for (const messages of Object.values(uiByLocale)) {
    const validated = assertStringRecord(messages, "UI messages");
    for (const key of Object.keys(validated)) uiKeys.add(key);
  }

  const navigationKeys = new Set();
  for (const translations of Object.values(navigationByLocale)) {
    const validated = assertStringRecord(translations, "Navigation messages");
    for (const key of Object.keys(validated)) navigationKeys.add(key);
  }

  const englishNavigation = assertStringRecord(
    environment.get("KLYX_EN_NAVIGATION_TRANSLATIONS") ?? {},
    "English navigation messages"
  );

  const catalogs = {};

  for (const locale of managedLocales) {
    const localeUi = assertStringRecord(
      uiByLocale[locale],
      `UI messages for ${locale}`
    );
    const localeNavigation = assertStringRecord(
      navigationByLocale[locale] ?? {},
      `Navigation messages for ${locale}`
    );
    const catalog = {};

    for (const key of uiKeys) {
      const value = localeUi[key];
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Missing UI translation for ${locale}: ${key}`);
      }
      catalog[`ui.${key}`] = value;
    }

    for (const sourceLabel of navigationKeys) {
      const value =
        locale === "fr"
          ? sourceLabel
          : localeNavigation[sourceLabel] ??
            englishNavigation[sourceLabel] ??
            sourceLabel;

      catalog[`navigation.${sourceLabel}`] = value;
    }

    catalogs[locale] = sortRecord(catalog);
  }

  const publishedSet = new Set(publishedLocales);
  const stagedLocales = managedLocales.filter(
    (locale) => !publishedSet.has(locale)
  );

  return {
    managedLocales,
    publishedLocales,
    stagedLocales,
    uiKeyCount: uiKeys.size,
    navigationKeyCount: navigationKeys.size,
    keyCountPerCatalog: uiKeys.size + navigationKeys.size,
    catalogs,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seed = await buildSeed();
  let preservedExistingKeys = 0;

  if (!options.check) {
    await fs.mkdir(options.outputDir, { recursive: true });

    for (const locale of seed.managedLocales) {
      const filePath = path.join(options.outputDir, `${locale}.json`);
      const existing = await readExistingCatalog(filePath);
      preservedExistingKeys += Object.keys(existing).length;

      const merged = sortRecord({
        ...seed.catalogs[locale],
        ...existing,
      });

      await fs.writeFile(
        filePath,
        `${JSON.stringify(merged, null, 2)}\n`,
        "utf8"
      );
    }
  }

  const summary = {
    managedLocales: seed.managedLocales,
    publishedLocales: seed.publishedLocales,
    stagedLocales: seed.stagedLocales,
    catalogCount: seed.managedLocales.length,
    uiKeyCount: seed.uiKeyCount,
    navigationKeyCount: seed.navigationKeyCount,
    keyCountPerCatalog: seed.keyCountPerCatalog,
    preservedExistingKeys,
    wroteFiles: !options.check,
    outputDir: path.relative(ROOT, options.outputDir) || ".",
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return;
  }

  process.stdout.write(
    [
      `Tolgee seed ${options.check ? "validated" : "generated"}.`,
      `Locales: ${summary.catalogCount}`,
      `Published: ${summary.publishedLocales.join(", ")}`,
      `Staged: ${summary.stagedLocales.length}`,
      `Keys/catalog: ${summary.keyCountPerCatalog}`,
      options.check
        ? "No files written."
        : `Output: ${summary.outputDir}`,
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
