import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider confirmed missions branding contract", () => {
  it("uses the exact KLYX blue while preserving mission routing and lifecycle behavior", () => {
    const missions = read(
      "app/provider/jobs/ProviderConfirmedMissionsSection.tsx"
    );

    expect(missions).toContain("#2563EB");
    for (const legacyAccent of [
      "blue-300",
      "blue-400",
      "blue-500",
      "blue-600",
      "blue-700",
      "violet-",
      "indigo-",
      "fuchsia-",
    ]) {
      expect(missions).not.toContain(legacyAccent);
    }

    expect(missions).toContain("if (card.actionRequired) return 0;");
    expect(missions).toContain("if (!card.history) return 1;");
    expect(missions).toContain('card.entityType === "booking"');
    expect(missions).toContain("`/bookings/${card.id}`");
    expect(missions).toContain("`/booking-groups/${card.id}`");
    expect(missions).toContain("formatKlyxBookingStatus(locale, mission.status)");
    expect(missions).toContain("formatKlyxBookingSlotCount(locale, mission.slotCount)");
    expect(missions).toContain("formatKlyxBookingAmount(");
    expect(missions).toContain("priorityMissionId");
    expect(missions).toContain("mission.actionRequired");
  });
});
