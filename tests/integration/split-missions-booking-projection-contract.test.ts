import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = fs
  .readFileSync(
    path.join(root, "app/api/bookings/split-missions/route.ts"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("split mission booking projection", () => {
  it("keeps the bookings read explicitly projected", () => {
    expect(route).not.toContain('.from("bookings")\n        .select("*")');
    expect(route).toContain(
      '.select("id, provider_id, babysitter_id, status, service_status")'
    );
  });
});
