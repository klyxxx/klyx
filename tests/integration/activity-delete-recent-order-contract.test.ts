import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

const ACTIVITY_MIGRATION =
  "20260905235000_klyx_activity_hidden_missions.sql";
const LEGACY_ACTIVITY_MIGRATION =
  "20260905081500_klyx_activity_hidden_missions.sql";

describe("KLYX Activity recent-first deletion contract", () => {
  it("renders one chronological stream newest first across booking and split missions", () => {
    const page = read("app/bookings/page.tsx");

    expect(page).toContain('data-order="created-at-desc"');
    expect(page).toContain("return [...bookingItems, ...splitItems].sort");
    expect(page).toContain("second.createdAt.localeCompare(first.createdAt)");
    expect(page).toContain('useState<BookingFilter>("all")');
    expect(page).toContain("SplitMissionCardView");
    expect(page).not.toContain("const nextBooking = useMemo");
  });

  it("keeps the video-driven Activity layout wide, compact and branded with exact KLYX blue", () => {
    const page = read("app/bookings/page.tsx");

    expect(page).toContain("max-w-6xl");
    expect(page).toContain("min-h-24");
    expect(page).toContain("#2563EB");
    expect(page).not.toContain("max-w-4xl");
    expect(page).not.toContain("min-h-56");
  });

  it("removes missions only from Activity and validates client ownership server-side", () => {
    const route = read("app/api/bookings/activity-hidden/route.ts");
    const migration = read(`supabase/migrations/${ACTIVITY_MIGRATION}`);

    expect(route).toContain('requireAccountType(profile, "client")');
    expect(route).toContain('.from("bookings")');
    expect(route).toContain('.eq("parent_id", clientProfileId)');
    expect(route).toContain('.from("booking_groups")');
    expect(route).toContain('.eq("client_profile_id", clientProfileId)');
    expect(route).toContain('.from("split_booking_batches")');
    expect(route).toContain('sourceRecordsDeleted: false');
    expect(route).toContain('ownershipScope: "client"');
    expect(route).not.toContain('.from("bookings").delete');
    expect(route).not.toContain('.from("booking_groups").delete');
    expect(route).not.toContain('.from("split_booking_batches").delete');

    expect(migration).toContain("activity_hidden_missions");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.activity_hidden_missions from anon, authenticated"
    );
    expect(migration).toContain("to service_role");
  });

  it("keeps exactly one current Activity migration without depending on global tail order", () => {
    const migrationDir = path.join(process.cwd(), "supabase/migrations");
    const migrations = fs
      .readdirSync(migrationDir)
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .sort();

    expect(migrations).toContain(ACTIVITY_MIGRATION);
    expect(migrations).not.toContain(LEGACY_ACTIVITY_MIGRATION);
    expect(
      migrations.filter((name) => name.endsWith("_klyx_activity_hidden_missions.sql"))
    ).toEqual([ACTIVITY_MIGRATION]);
  });

  it("requires explicit confirmation and preserves the #543 fail-closed Activity rendering guard", () => {
    const page = read("app/bookings/page.tsx");
    const compactPage = page.replace(/\s+/g, " ");

    expect(page).toContain("window.confirm");
    expect(page).toContain('method: "POST"');
    expect(page).toContain("!Array.isArray(body.cards)");
    expect(page).toContain("hiddenBody.ok !== true");
    expect(page).toContain("!Array.isArray(hiddenBody.hidden)");
    expect(compactPage).toContain(") : errorKey ? null : counts.all === 0 ? (");
  });
});
