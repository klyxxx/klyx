import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs
  .readFileSync(
    path.join(process.cwd(), "app/bookings/[id]/page.tsx"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX destructive booking action confirmation contract", () => {
  it("requires confirmation for rejection and cancellation before any busy state or API mutation", () => {
    expect(source).toContain("KLYX_DESTRUCTIVE_BOOKING_CONFIRMATION_16_15");
    expect(source).toContain('status === "rejected" || status === "cancelled"');
    expect(source).toContain(
      "!window.confirm(destructiveStatusConfirmation(locale, status))"
    );

    const confirmationIndex = source.indexOf(
      "!window.confirm(destructiveStatusConfirmation(locale, status))"
    );
    const busyIndex = source.indexOf("setActiveAction(status);", confirmationIndex);
    const mutationIndex = source.indexOf(
      'fetch("/api/bookings/status"',
      confirmationIndex
    );

    expect(confirmationIndex).toBeGreaterThan(-1);
    expect(busyIndex).toBeGreaterThan(confirmationIndex);
    expect(mutationIndex).toBeGreaterThan(confirmationIndex);
  });

  it("does not require destructive confirmation for accepting a pending request", () => {
    expect(source).toContain('onClick={() => void updateStatus("accepted")}');
    expect(source).not.toContain(
      'status === "accepted" &&\n      !window.confirm'
    );
  });

  it("explains refund consequences before a cancellation is confirmed", () => {
    expect(source).toContain("peut lancer un remboursement");
    expect(source).toContain("may start a refund");
    expect(source).toContain("terugbetaling");
    expect(source).toContain("Rückerstattung");
  });
});
