import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(
    process.cwd(),
    "app/api/bookings/overview/route.ts"
  ),
  "utf8"
);

const canonicalSchema = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
  ),
  "utf8"
);

describe("KLYX booking overview schema contract", () => {
  it("uses only the canonical booking amount column", () => {
    expect(routeSource).toContain(
      "estimated_amount_cents"
    );
    expect(routeSource).not.toContain(
      "amount_total"
    );
  });

  it("matches the canonical production schema snapshot", () => {
    expect(canonicalSchema).toContain(
      '"estimated_amount_cents"'
    );
    expect(canonicalSchema).not.toContain(
      '"amount_total"'
    );
  });

  it("keeps the secure booking overview error boundary", () => {
    expect(routeSource).toContain(
      "secureApiErrorResponse"
    );
    expect(routeSource).toContain(
      '"booking_overview_failed"'
    );
  });
});
