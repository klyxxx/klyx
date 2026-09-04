import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootLayoutSource = readFileSync(
  join(process.cwd(), "app/layout.tsx"),
  "utf8"
);
const themeProviderSource = readFileSync(
  join(process.cwd(), "app/components/ThemeProvider.tsx"),
  "utf8"
);

describe("KLYX first-open light theme contract", () => {
  it("uses light before any saved user theme exists", () => {
    expect(rootLayoutSource).toContain(
      'localStorage.getItem("klyx_theme") || "light"'
    );
    expect(themeProviderSource).toContain(
      'useState<Theme>("light")'
    );
    expect(themeProviderSource).toMatch(
      /savedTheme === "system"[\s\S]*\? savedTheme[\s\S]*: "light";/
    );
  });

  it("keeps explicit dark and system preferences supported", () => {
    expect(themeProviderSource).toContain(
      'export type Theme = "light" | "dark" | "system"'
    );
    expect(themeProviderSource).toContain(
      'theme === "system" ? getSystemTheme() : theme'
    );
    expect(themeProviderSource).toContain(
      'localStorage.setItem(STORAGE_KEY, newTheme)'
    );
  });

  it("keeps the first browser chrome paint light and syncs later choices", () => {
    expect(rootLayoutSource).toContain('themeColor: "#ffffff"');
    expect(rootLayoutSource).toContain('statusBarStyle: "default"');
    expect(themeProviderSource).toContain("syncBrowserThemeColor(resolvedTheme)");
    expect(themeProviderSource).toContain('DARK_THEME_COLOR = "#09090b"');
  });
});
