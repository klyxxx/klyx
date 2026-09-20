import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260918211000_klyx_platform_held_group_multiexecutor_test.sql"),
  "utf8"
);

describe("multi-executor group settlement migration syntax", () => {
  it("contains one canonical body for every server-only RPC", () => {
    const names = [...source.matchAll(/create or replace function public\.([A-Za-z0-9_]+)\(/g)]
      .map((match) => match[1]);
    expect(names).toHaveLength(19);
    expect(new Set(names).size).toBe(19);
  });

  it("uses complete PL/pgSQL dollar delimiters and one transaction commit", () => {
    expect(source).not.toMatch(/^as \$$/m);
    expect(source).not.toMatch(/^\$;$/m);
    expect(source).not.toContain("commit;\n then");

    const functionCount = source.match(/create or replace function public\./g)?.length ?? 0;
    const openCount = source.match(/^as \$\$$/gm)?.length ?? 0;
    const closeCount = source.match(/^\$\$;$/gm)?.length ?? 0;
    const commitCount = source.match(/^commit;$/gm)?.length ?? 0;

    expect(openCount).toBe(functionCount);
    expect(closeCount).toBe(functionCount);
    expect(commitCount).toBe(1);
  });
});
