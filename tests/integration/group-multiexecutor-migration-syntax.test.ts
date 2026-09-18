import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260918211000_klyx_platform_held_group_multiexecutor_test.sql"
  ),
  "utf8"
);

describe("multi-executor group settlement migration syntax", () => {
  it("uses complete PL/pgSQL dollar delimiters for every function body", () => {
    expect(source).not.toMatch(/^as \$$/m);

    const functionCount =
      source.match(/create or replace function public\./g)?.length ?? 0;
    const openBodyCount = source.match(/^as \$\$$/gm)?.length ?? 0;

    expect(functionCount).toBeGreaterThan(0);
    expect(openBodyCount).toBe(functionCount);
  });
});
