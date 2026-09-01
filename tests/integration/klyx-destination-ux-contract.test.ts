import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX destination UX contract", () => {
  it("loads the native destination foundation after the legacy visual layers", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain('import "./klyx-destination-system.css";');
    expect(layout.indexOf('import "./klyx-destination-system.css";')).toBeGreaterThan(
      layout.indexOf('import "./klyx-quality-system.css";')
    );
  });

  it("scopes the white black and exact KLYX blue destination language to app content", () => {
    const source = read("app/klyx-destination-system.css");

    expect(source).toContain(".klyx-app-content {");
    expect(source).toContain("--primary: #2563eb;");
    expect(source).toContain("background: #2563eb !important;");
    expect(source).toContain('[class*="bg-gradient-to-"]');
    expect(source).toContain("background-image: none !important;");
    expect(source).not.toContain(".klyx-sidebar");
    expect(source).not.toContain("violet");
    expect(source).not.toContain("indigo");
  });

  it("keeps Profile calm by hiding editing until the user asks for it", () => {
    const source = read("app/profile/page.tsx");

    expect(source).toContain("KLYX_PROFILE_PROGRESSIVE_DISCLOSURE");
    expect(source).toContain("const [editingProfile, setEditingProfile] = useState(false)");
    expect(source).toContain("aria-expanded={editingProfile}");
    expect(source).toContain("{editingProfile && (");
    expect(source).toContain('href="/settings"');
    expect(source).toContain('t("settings")');
  });

  it("keeps Settings compact and reveals one focused group at a time", () => {
    const source = read("app/settings/page.tsx");

    expect(source).toContain("KLYX_SETTINGS_PROGRESSIVE_DISCLOSURE");
    expect(source).toContain("const [openPanel, setOpenPanel] = useState<SettingsPanel>(null)");
    expect(source).toContain("function togglePanel");
    expect(source).toContain("function SettingsDisclosure");
    expect(source).toContain("aria-expanded={open}");
    expect(source).toContain("{open && (");
    expect(source).toContain("<PhoneSettingsInline />");
    expect(source).toContain("<PhonePrivacyControls />");
    expect(source).toContain("<PhoneAccessHistory />");
    expect(source).not.toContain("violet-");
    expect(source).not.toContain("indigo-");
  });
});
