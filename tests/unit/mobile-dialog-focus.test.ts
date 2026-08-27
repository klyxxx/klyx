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

describe("mobile sidebar accessibility contract", () => {
  it("provides a reusable keyboard focus trap", () => {
    expect(helper).toContain("MOBILE_DIALOG_FOCUSABLE_SELECTOR");
    expect(helper).toContain("event.key !== 'Tab'");
    expect(helper).toContain("event.preventDefault()");
    expect(helper).toContain("container.focus()");
  });

  it("renders the mobile drawer as a modal dialog with focus management", () => {
    expect(sidebar).toContain('role="dialog"');
    expect(sidebar).toContain('aria-modal="true"');
    expect(sidebar).toContain("trapDialogTabKey");
    expect(sidebar).toContain('event.key === "Escape"');
    expect(sidebar).toContain("mobileMenuTriggerRef.current?.focus()");
  });
});
