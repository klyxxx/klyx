import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const overview = read("app/api/bookings/overview/route.ts");
const detail = read("app/bookings/[id]/page.tsx");

describe("KLYX single booking refund UI state", () => {
  it("loads refund status in the booking overview", () => {
    expect(overview).toContain("payment_status, refund_status, service_status");
    expect(overview).toContain("booking.refund_status");
    expect(overview).toContain('status:\n        "refund_processing"');
    expect(overview).toContain('status:\n        "refund_failed"');
    expect(overview).toContain('status:\n        "refunded"');
    expect(overview).toContain('booking.refund_status ??\n          "not_required"');
  });

  it("never marks a refunded booking as requiring payment", () => {
    expect(overview).toContain('booking.payment_status !==\n      "refunded"');
    expect(detail).toContain('booking.payment_status !== "refunded"');
  });

  it("shows explicit refund labels on booking detail", () => {
    expect(detail).toContain('refund_status: string | null');
    expect(detail).toContain("payment_status, refund_status, service_status");
    expect(detail).toContain('"Remboursement confirmé"');
    expect(detail).toContain('"Remboursement en cours"');
    expect(detail).toContain('"Remboursement à vérifier"');
  });
});
