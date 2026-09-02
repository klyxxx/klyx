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
    expect(switcher).toContain('max-h-[min(22rem,calc(100vh-13rem))]');
    expect(switcher).not.toContain('w-[min(88vw,320px)]');
  });

  it("keeps desktop and mobile navigation geometry stable", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain('data-testid="desktop-sidebar"');
    expect(sidebar).toContain('data-testid="desktop-navigation"');
    expect(sidebar).toContain('data-testid="mobile-navigation"');
    expect(sidebar).toContain('min-h-0 flex-1 overflow-y-auto');
    expect(sidebar).toContain('fixed inset-x-0 bottom-0 z-50');
  });
});
