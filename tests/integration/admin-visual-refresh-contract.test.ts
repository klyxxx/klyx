import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminLayoutSource = readFileSync(
  join(process.cwd(), "app/admin/layout.tsx"),
  "utf8"
);
const adminStylesSource = readFileSync(
  join(process.cwd(), "app/admin/admin-refresh.css"),
  "utf8"
);

describe("KLYX admin visual refresh contract", () => {
  it("applies one shared admin shell to every admin route", () => {
    expect(adminLayoutSource).toContain('import "./admin-refresh.css"');
    expect(adminLayoutSource).toContain('className="klyx-admin-shell"');
    expect(adminLayoutSource).toContain('href="/admin"');
    expect(adminLayoutSource).toContain("KLYX");
    expect(adminLayoutSource).toContain("Admin");
  });

  it("uses the exact KLYX blue and neutralizes legacy dark admin heroes", () => {
    expect(adminStylesSource).toContain("--klyx-admin-blue: #2563eb");
    expect(adminStylesSource).toContain(
      'section[class*="bg-[linear-gradient"]'
    );
    expect(adminStylesSource).toContain("background: var(--card) !important");
    expect(adminStylesSource).toContain("color: var(--foreground) !important");
  });

  it("maps legacy violet and indigo identity accents to KLYX blue", () => {
    expect(adminStylesSource).toContain('[class*="text-violet-"]');
    expect(adminStylesSource).toContain('[class*="text-indigo-"]');
    expect(adminStylesSource).toContain('[class*="bg-violet-600"]');
    expect(adminStylesSource).toContain('[class*="bg-indigo-600"]');
  });

  it("does not override semantic success, warning or error colors", () => {
    expect(adminStylesSource).not.toContain('[class*="text-emerald-"]');
    expect(adminStylesSource).not.toContain('[class*="text-amber-"]');
    expect(adminStylesSource).not.toContain('[class*="text-rose-"]');
    expect(adminStylesSource).not.toContain('[class*="bg-emerald-"]');
    expect(adminStylesSource).not.toContain('[class*="bg-amber-"]');
    expect(adminStylesSource).not.toContain('[class*="bg-rose-"]');
  });

  it("keeps admin routes excluded from indexing", () => {
    expect(adminLayoutSource).toContain("index: false");
    expect(adminLayoutSource).toContain("follow: false");
    expect(adminLayoutSource).toContain("nocache: true");
  });
});
