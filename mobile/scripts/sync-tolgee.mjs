import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const mobileRoot = process.cwd();
const source = path.resolve(mobileRoot, "..", "messages", "tolgee");
const target = path.resolve(mobileRoot, "src", "i18n", "catalogs");

await mkdir(target, { recursive: true });

const files = (await readdir(source)).filter((name) => name.endsWith(".json"));

for (const file of files) {
  await cp(path.join(source, file), path.join(target, file));
}

console.log(`KLYX mobile: ${files.length} Tolgee catalog(s) synchronized.`);
