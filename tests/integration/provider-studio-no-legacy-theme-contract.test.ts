import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/ProviderStudio.tsx"),
  "utf8"
);

test("provider Services source contains no legacy identity palette or dashboard wording", () => {
  expect(source).not.toMatch(
    /#2563EB|blue-|violet-|indigo-|fuchsia-|bg-gradient|linear-gradient|Tableau de bord|KLYX_PROVIDER_STUDIO_NATIVE_SINGLE_BLUE/
  );

  expect(source).toContain("text-primary");
  expect(source).toContain("bg-primary");
  expect(source).toContain("text-primary-foreground");
  expect(source).toContain("accent-primary");
});
