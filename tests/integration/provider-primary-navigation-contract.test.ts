import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX unified primary navigation", () => {
  it("keeps one four-item navigation for every account", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain("const unifiedItems: MenuItem[] = [");
    expect(sidebar).toContain('title: "KLYX"');
    expect(sidebar).toContain('href: "/assistant"');
    expect(sidebar).toContain('title: "Activité"');
    expect(sidebar).toContain('href: "/bookings"');
    expect(sidebar).toContain('title: "Messages"');
    expect(sidebar).toContain('href: "/messages"');
    expect(sidebar).toContain('title: "Profil"');
    expect(sidebar).toContain('href: "/profile"');

    expect(sidebar).not.toContain("const clientItems");
    expect(sidebar).not.toContain("const providerItems");
    expect(sidebar).not.toContain("AccountSwitcher");
    expect(sidebar).not.toContain("KLYX_ACTIVE_PROFILE_CHANGED");
    expect(sidebar).not.toContain('href: "/provider/assistant"');
    expect(sidebar).not.toContain('href: "/provider/jobs"');
    expect(sidebar).not.toContain('href: "/provider/studio"');
    expect(sidebar).not.toContain('href: "/provider/payments"');
  });

  it("keeps the same primary destination on desktop and mobile", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");
    const assistantHrefCount = sidebar.split('href="/assistant"').length - 1;

    expect(assistantHrefCount).toBeGreaterThanOrEqual(2);
    expect(sidebar).toContain('data-testid="desktop-navigation"');
    expect(sidebar).toContain('data-testid="mobile-navigation"');
  });
});
