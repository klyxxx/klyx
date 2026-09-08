import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const bookingsPage = read("app/bookings/page.tsx");
const compactBookingsPage = bookingsPage.replace(/\s+/g, " ");

describe("KLYX bookings load error vs empty state contract", () => {
  it("does not render the unified Activity mission stream after a failed load", () => {
    expect(compactBookingsPage).toContain(
      ") : errorKey ? null : counts.all === 0 ? ("
    );
    expect(bookingsPage).toContain("visibleItems.map");
  });

  it("never presents an API failure as an empty bookings account", () => {
    expect(compactBookingsPage).toContain(
      ") : errorKey ? null : counts.all === 0 ? ("
    );
    expect(bookingsPage).toContain("<EmptyState />");
  });

  it("keeps the explicit refresh action available while load or deletion errors are visible", () => {
    expect(bookingsPage).toContain("onClick={() => void loadBookings()}");
    expect(bookingsPage).toContain("{(errorKey || deleteError) && (");
  });
});
