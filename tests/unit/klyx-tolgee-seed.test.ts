import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type TolgeeSeedSummary = {
  managedLocales: string[];
  publishedLocales: string[];
  stagedLocales: string[];
  catalogCount: number;
  uiKeyCount: number;
  navigationKeyCount: number;
  keyCountPerCatalog: number;
  preservedExistingKeys: number;
  wroteFiles: boolean;
  outputDir: string;
};

const temporaryDirectories: string[] = [];
const scriptPath = path.join(
  process.cwd(),
  "scripts",
  "i18n",
  "export-tolgee-seed.mjs"
);

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "klyx-tolgee-seed-"));
  temporaryDirectories.push(directory);
  return directory;
}

function runSeed(...args: string[]) {
  const output = execFileSync(
    process.execPath,
    [scriptPath, ...args, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    }
  );

  return JSON.parse(output.trim()) as TolgeeSeedSummary;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("KLYX Tolgee seed exporter", () => {
  it("validates every registered locale while keeping publication conservative", () => {
    const summary = runSeed("--check");

    expect(summary.wroteFiles).toBe(false);
    expect(summary.catalogCount).toBe(summary.managedLocales.length);
    expect(summary.managedLocales.length).toBeGreaterThan(4);
    expect(summary.publishedLocales).toEqual(["fr", "en", "nl", "de"]);
    expect(summary.stagedLocales).toContain("es");
    expect(summary.uiKeyCount).toBeGreaterThan(0);
    expect(summary.navigationKeyCount).toBeGreaterThan(0);
    expect(summary.keyCountPerCatalog).toBe(
      summary.uiKeyCount + summary.navigationKeyCount
    );
  });

  it("generates Tolgee JSON without overwriting locally reviewed translations", async () => {
    const outputDirectory = await createTemporaryDirectory();
    const spanishPath = path.join(outputDirectory, "es.json");

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      spanishPath,
      JSON.stringify(
        {
          "remote.reviewed": "Conservar",
          "ui.skipToMain": "Revisado en Tolgee",
        },
        null,
        2
      ),
      "utf8"
    );

    const summary = runSeed("--output-dir", outputDirectory);
    const french = JSON.parse(
      await readFile(path.join(outputDirectory, "fr.json"), "utf8")
    ) as Record<string, string>;
    const spanish = JSON.parse(
      await readFile(spanishPath, "utf8")
    ) as Record<string, string>;

    expect(summary.wroteFiles).toBe(true);
    expect(summary.preservedExistingKeys).toBe(2);
    expect(french["ui.skipToMain"]).toBe("Aller au contenu principal");
    expect(spanish["ui.skipToMain"]).toBe("Revisado en Tolgee");
    expect(spanish["ui.sidebar.logout"]).toBe("Cerrar sesión");
    expect(spanish["remote.reviewed"]).toBe("Conservar");
  });
});
