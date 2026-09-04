import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("sidebar navigation accessibility i18n contract", () => {
  it("uses localized aria labels without changing navigation structure", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain(
      'translateKlyxSidebarNavigation(locale,\n    "desktopNavigation"'
    );
    expect(sidebar).toContain(
      'translateKlyxSidebarNavigation(locale,\n    "mobileNavigation"'
    );
    expect(sidebar).toContain("aria-label={desktopNavigationLabel}");
    expect(sidebar).toContain("aria-label={mobileNavigationLabel}");
    expect(sidebar).not.toContain('aria-label="Navigation principale KLYX"');
    expect(sidebar).not.toContain('aria-label="Navigation mobile KLYX"');

    expect(sidebar).toContain('data-testid="desktop-navigation"');
    expect(sidebar).toContain('data-testid="mobile-navigation"');
    expect(sidebar).toContain("grid-cols-4");
  });

  it("preserves the separately localized provider assistant launcher", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain(
      'translateKlyxProviderAssistant(locale, "badge")'
    );
    expect(sidebar).toContain('data-testid="provider-assistant-launcher-desktop"');
    expect(sidebar).toContain('data-testid="provider-assistant-launcher-mobile"');
    expect(sidebar).toContain("aria-label={providerAssistantLabel}");
  });
});
