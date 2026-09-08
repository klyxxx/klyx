import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/ProviderStudio.tsx"),
  "utf8"
);

test("provider Services keeps publish dominant and draft save secondary", () => {
  const publishIndex = source.indexOf("onClick={() => void saveStudio(true)}");
  const draftIndex = source.indexOf("onClick={() => void saveStudio(false)}");

  expect(publishIndex).toBeGreaterThan(-1);
  expect(draftIndex).toBeGreaterThan(publishIndex);

  const publishAction = source.slice(publishIndex, publishIndex + 700);
  const draftAction = source.slice(draftIndex, draftIndex + 700);

  expect(publishAction).toContain("bg-primary");
  expect(publishAction).toContain("text-primary-foreground");
  expect(publishAction).not.toContain("bg-blue-");
  expect(draftAction).toContain("border border-border");
});
