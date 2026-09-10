import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("KLYX private consoles Aura Noir contract", () => {
  it("uses the same theme-aware KLYX mark inside Founder and Admin consoles", () => {
    const adminLayout = read("app/admin/layout.tsx");
    const founderLayout = read("app/founder/layout.tsx");

    for (const source of [adminLayout, founderLayout]) {
      expect(source).toContain("KlyxThemeImage");
      expect(source).toContain('srcLight="/icon.svg"');
      expect(source).toContain('srcDark="/apple-icon.svg"');
    }
  });

  it("gives Founder one shared Aura Noir shell without changing route privacy", () => {
    const founderLayout = read("app/founder/layout.tsx");
    const founderStyles = read("app/founder/founder-refresh.css");

    expect(founderLayout).toContain('import "./founder-refresh.css"');
    expect(founderLayout).toContain('className="klyx-founder-shell"');
    expect(founderLayout).toContain('href="/founder"');
    expect(founderLayout).toContain("index: false");
    expect(founderLayout).toContain("follow: false");
    expect(founderLayout).toContain("nocache: true");
    expect(founderStyles).toContain("--klyx-founder-blue: #2563eb");
    expect(founderStyles).toContain('section[class*="bg-[linear-gradient"]');
    expect(founderStyles).toContain("background: var(--card) !important");
  });

  it("keeps Founder console identity blue while the global Founder utility stays neutral", () => {
    const founderStyles = read("app/founder/founder-refresh.css");
    const founderMenu = read("app/components/FounderCompactMenu.tsx");

    expect(founderStyles).toContain('[class*="text-violet-"]');
    expect(founderStyles).toContain('[class*="text-indigo-"]');
    expect(founderStyles).toContain('[class*="bg-violet-600"]');
    expect(founderStyles).not.toContain('[class*="text-emerald-"]');
    expect(founderStyles).not.toContain('[class*="text-rose-"]');
    expect(founderMenu).not.toContain("#2563EB");
    expect(founderMenu).not.toMatch(/violet|indigo|fuchsia|amber-400/i);
    expect(founderMenu).toContain("border-dashed");
    expect(founderMenu).toContain("text-muted-foreground");
  });

  it("keeps Admin on the exact same Aura Noir brand language", () => {
    const adminLayout = read("app/admin/layout.tsx");
    const adminStyles = read("app/admin/admin-refresh.css");

    expect(adminLayout).toContain('className="klyx-admin-shell"');
    expect(adminStyles).toContain("--klyx-admin-blue: #2563eb");
    expect(adminStyles).toContain(".dark .klyx-admin-shell");
    expect(adminStyles).not.toMatch(/background: var\(--klyx-admin-blue\);\n  color: white;\n  box-shadow: 0 8px 22px/);
  });
});
