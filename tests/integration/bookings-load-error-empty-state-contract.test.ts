import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const bookingsPage = read("app/bookings/page.tsx");

describe("KLYX bookings load error vs empty state contract", () => {
  it("does not render the split mission surface after a failed load", () => {
    expect(bookingsPage).toContain(
      "{!loading && !errorKey && (\n          <SplitMissionSection"
    );
  });

  it("never presents an API failure as an empty bookings account", () => {
    expect(bookingsPage).toContain(
      ") : errorKey ? null : bookings.length === 0 && splitMissions.length === 0 ? ("
    );
    expect(bookingsPage).toContain("<EmptyState />");
  });

  it("keeps the explicit refresh action available while the error is visible", () => {
    expect(bookingsPage).toContain("onClick={() => void loadBookings()}");
    expect(bookingsPage).toContain("{errorKey && (");
  });
});
