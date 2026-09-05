import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs
  .readFileSync(
    path.join(
      process.cwd(),
      ".github/workflows/klyx-supabase-production-migrations.yml"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX Supabase production migration ordering contract", () => {
  it("includes out-of-order local migrations in preview, apply and verification", () => {
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --include-all --dry-run'
    );
    expect(workflow).toContain(
      'supabase db push --linked --include-all --dry-run'
    );
    expect(workflow).toContain(
      'supabase db push --db-url "$SUPABASE_EFFECTIVE_DB_URL" --include-all'
    );
    expect(workflow).toContain(
      'supabase db push --linked --include-all'
    );
  });
});
