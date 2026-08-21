import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const baseline = readRepoFile(
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
);
const fixture = readRepoFile("scripts/golden-path-provider-fixture.mjs");

function userServicesTableDefinition() {
  const start = baseline.indexOf(
    'CREATE TABLE IF NOT EXISTS "public"."user_services"'
  );
  const end = baseline.indexOf(
    'ALTER TABLE "public"."user_services" OWNER TO "postgres";',
    start
  );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return baseline.slice(start, end);
}

function userServicesActivationUpdate() {
  const start = fixture.indexOf('.from("user_services")\n    .update({');
  const end = fixture.indexOf(
    '.eq("id", userService.id)',
    start
  );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return fixture.slice(start, end);
}

describe("KLYX golden provider fixture schema contract", () => {
  it("records the canonical user_services columns", () => {
    const table = userServicesTableDefinition();

    expect(table).toContain('"active" boolean DEFAULT true');
    expect(table).toContain('"provider_enabled" boolean DEFAULT true NOT NULL');
    expect(table).not.toContain('"updated_at"');
  });

  it("updates only columns present on user_services", () => {
    const update = userServicesActivationUpdate();

    expect(update).toContain("active: true");
    expect(update).toContain("provider_enabled: true");
    expect(update).not.toContain("updated_at");
  });
});
