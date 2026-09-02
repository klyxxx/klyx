import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX account switcher layout contract", () => {
  it("keeps the profile menu anchored without changing sidebar flow", () => {
    const switcher = read("app/components/AccountSwitcher.tsx");

    expect(switcher).toContain('data-testid="account-switcher"');
    expect(switcher).toContain('className="relative isolate w-full"');
    expect(switcher).toContain('className="absolute left-0 right-0 top-full');
    expect(switcher).toContain('max-h-[min(22rem,calc(100dvh_-_13rem))]');
    expect(switcher).not.toContain('w-[min(88vw,320px)]');
  });

  it("pins desktop navigation to the viewport and reserves its layout width", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain('data-testid="desktop-sidebar-space"');
    expect(sidebar).toContain('className="hidden w-[280px] shrink-0 lg:block"');
    expect(sidebar).toContain('data-testid="desktop-sidebar"');
    expect(sidebar).toContain('fixed inset-y-0 left-0 z-40');
    expect(sidebar).toContain('h-dvh w-[280px]');
    expect(sidebar).not.toContain('className="sticky top-0 isolate hidden h-screen');
    expect(sidebar).toContain('data-testid="desktop-navigation"');
    expect(sidebar).toContain('min-h-0 flex-1 overflow-y-auto');
  });

  it("keeps the mobile navigation fixed independently from page scrolling", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain('data-testid="mobile-navigation"');
    expect(sidebar).toContain('fixed inset-x-0 bottom-0 z-50');
  });
});
