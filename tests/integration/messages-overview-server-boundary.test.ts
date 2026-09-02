import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX messages overview server boundary", () => {
  it("loads the overview through the authenticated server route", () => {
    const page = read("app/messages/page.tsx");

    expect(page).toContain('fetch("/api/messages/overview"');
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).not.toContain('.from("messages")');
    expect(page).not.toContain('.from("bookings")');
    expect(page).not.toContain('.from("profiles")');
  });

  it("authorizes the active profile before using the admin client", () => {
    const route = read("app/api/messages/overview/route.ts");

    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain('supabaseAdmin\n      .from("messages")');
    expect(route).toContain('sender_id.eq.${profileId},receiver_id.eq.${profileId}');
    expect(route).toContain("booking.parent_id === profileId");
    expect(route).toContain("booking.babysitter_id === profileId");
    expect(route).toContain('status >= 500\n            ? "Impossible de charger les conversations."');
  });
});
