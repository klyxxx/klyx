import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/components/AvailabilityEditor.tsx"),
  "utf8"
);

describe("provider availability editor data contract", () => {
  it("preserves the availability_slots read boundary", () => {
    expect(source).toContain('.from("availability_slots")');
    expect(source).toContain(
      '"id, user_service_id, day_of_week, start_time, end_time, is_active"'
    );
    expect(source).toContain('.eq("user_service_id", userServiceId)');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('.order("day_of_week", { ascending: true })');
  });

  it("preserves replace-on-save delete and insert behavior", () => {
    expect(source).toContain('.from("availability_slots")\n        .delete()');
    expect(source).toContain('.from("availability_slots")\n          .insert(');
    expect(source).toContain("user_service_id: userServiceId");
    expect(source).toContain("day_of_week: day.dayOfWeek");
    expect(source).toContain("start_time: day.startTime");
    expect(source).toContain("end_time: day.endTime");
    expect(source).toContain("is_active: true");
  });

  it("keeps visible failures presentation-safe", () => {
    expect(source).toContain('t("loadError")');
    expect(source).toContain('t("saveError")');
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("deleteError.message");
    expect(source).not.toContain("insertError.message");
  });
});
