import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/ProviderStudio.tsx"),
  "utf8"
);

test("provider Services source contains no legacy palette or dashboard wording", () => {
  expect(source).not.toMatch(/violet-|indigo-|fuchsia-|bg-gradient|from-violet|Tableau de bord/);
  expect(source).toContain("KLYX_PROVIDER_STUDIO_NATIVE_SINGLE_BLUE");
  expect(source).toContain("bg-blue-600");
  expect(source).toContain("text-blue-600");
  expect(source).toContain("accent-blue-600");
});
