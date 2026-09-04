import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const helper = fs.readFileSync(
  path.join(process.cwd(), "lib/mobile-dialog-focus.ts"),
  "utf8"
);

const sidebar = fs.readFileSync(
  path.join(process.cwd(), "app/ui/AppSidebar.tsx"),
  "utf8"
);

describe("mobile navigation accessibility contract", () => {
  it("provides a reusable keyboard focus trap", () => {
    expect(helper).toContain("MOBILE_DIALOG_FOCUSABLE_SELECTOR");
    expect(helper).toContain("event.key !== 'Tab'");
    expect(helper).toContain("event.preventDefault()");
    expect(helper).toContain("container.focus()");
  });

  it("uses a fixed four-entry mobile navigation instead of a modal drawer", () => {
    expect(sidebar).toContain("aria-label={mobileNavigationLabel}");
    expect(sidebar).toContain("grid-cols-4");
    expect(sidebar).toContain("min-h-14");
    expect(sidebar).not.toContain('role="dialog"');
    expect(sidebar).not.toContain('aria-modal="true"');
    expect(sidebar).not.toContain("trapDialogTabKey");
    expect(sidebar).not.toContain("mobileMenuTriggerRef");
  });
});
