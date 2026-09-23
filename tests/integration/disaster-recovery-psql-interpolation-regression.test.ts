import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/klyx-supabase-full-restore-drill.yml"),
  "utf8"
);

describe("DR public-table fingerprint psql interpolation regression", () => {
  it("feeds identifier-parameterized count queries through stdin", () => {
    expect(workflow).toContain(
      "printf '%s\\n' 'select count(*) from public.:\"table\";' |"
    );
    expect(workflow).toContain(
      'docker exec -i "$KLYX_FULL_DR_DB_CONTAINER"'
    );
    expect(workflow).not.toContain(
      "--command 'select count(*) from public.:\"table\";'"
    );
  });

  it("captures the internal klyx_private schema with public so cross-schema dependencies restore in pg_dump order", () => {
    expect(workflow).toContain("--schema public,klyx_private");
    expect(workflow).toContain("--schema public             --data-only");
  });
});
