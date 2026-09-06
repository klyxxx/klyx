import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type CatalogCheckSummary = {
  trackedLocales: string[];
  trackedCatalogCount: number;
  requiredLocales: string[];
  managedLocaleCount: number;
  keyCountPerCatalog: number;
};

const checkScript = path.join(
  process.cwd(),
  "scripts",
  "i18n",
  "check-tolgee-catalogs.mjs"
);
const catalogDirectory = path.join(process.cwd(), "messages", "tolgee");
const bootstrapLocales = ["fr", "en", "nl", "de", "es"] as const;
const temporaryDirectories: string[] = [];

function runCheck(catalogDir = catalogDirectory) {
  const output = execFileSync(
    process.execPath,
    [checkScript, "--catalog-dir", catalogDir, "--json"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  return JSON.parse(output.trim()) as CatalogCheckSummary;
}

async function createCatalogCopy() {
  const directory = await mkdtemp(path.join(tmpdir(), "klyx-tolgee-catalogs-"));
  temporaryDirectories.push(directory);

  await Promise.all(
    bootstrapLocales.map((locale) =>
      copyFile(
        path.join(catalogDirectory, `${locale}.json`),
        path.join(directory, `${locale}.json`)
      )
    )
  );

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("KLYX Tolgee committed catalog baseline", () => {
  it("tracks the published locales plus staged Spanish without publishing it", () => {
    const summary = runCheck();

    expect(summary.trackedLocales).toEqual(["de", "en", "es", "fr", "nl"]);
    expect(summary.trackedCatalogCount).toBe(5);
    expect(summary.requiredLocales).toEqual(["fr", "en", "nl", "de", "es"]);
    expect(summary.managedLocaleCount).toBeGreaterThan(summary.trackedCatalogCount);
    expect(summary.keyCountPerCatalog).toBeGreaterThan(0);
  });

  it("allows reviewed values but rejects a missing generated seed key", async () => {
    const directory = await createCatalogCopy();
    const spanishPath = path.join(directory, "es.json");
    const spanish = JSON.parse(
      await readFile(spanishPath, "utf8")
    ) as Record<string, string>;

    spanish["ui.skipToMain"] = "Revisado en Tolgee";
    await writeFile(spanishPath, `${JSON.stringify(spanish, null, 2)}\n`, "utf8");
    expect(runCheck(directory).trackedCatalogCount).toBe(5);

    delete spanish["ui.sidebar.logout"];
    await writeFile(spanishPath, `${JSON.stringify(spanish, null, 2)}\n`, "utf8");

    const failed = spawnSync(
      process.execPath,
      [checkScript, "--catalog-dir", directory, "--json"],
      { cwd: process.cwd(), encoding: "utf8" }
    );

    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain(
      "Missing Tolgee seed key in es.json: ui.sidebar.logout"
    );
  });
});
