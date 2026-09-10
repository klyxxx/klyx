import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const founderAccess = read("app/components/FounderAccessBar.tsx");
const founderMenu = read("app/components/FounderCompactMenu.tsx");
const founderAuth = read("lib/founder-auth.ts");
const quality = read("app/klyx-quality-system.css");

describe("KLYX shell polish", () => {
  it("keeps Founder visibility fail-closed behind the server allowlist", () => {
    expect(founderAuth).toContain('import "server-only";');
    expect(founderAuth).toContain("configuredFounderIds().has(user.id)");
    expect(founderAccess).toContain("await isKlyxFounder()");
    expect(founderAccess).toMatch(
      /if \(!founder\) \{\s*return null;\s*\}[\s\S]*?await import\(\s*"@\/lib\/active-profile"\s*\)/
    );
  });

  it("keeps Founder and Admin destinations while visually demoting the trigger", () => {
    for (const href of [
      'href="/founder"',
      'href="/admin"',
      'href="/founder/test"',
      'href="/founder/cleanup"',
      'href="/founder/final-check"',
    ]) {
      expect(founderMenu).toContain(href);
    }

    expect(founderMenu).toContain('aria-label="Ouvrir les outils internes Founder"');
    expect(founderMenu).toContain("border-dashed");
    expect(founderMenu).toContain("text-[11px]");
    expect(founderMenu).toContain("opacity-70");
    expect(founderMenu).not.toContain("shadow-xl");
  });

  it("caps only the empty assistant vertical stage on desktop", () => {
    expect(quality).toContain('@media (min-width: 64rem)');
    expect(quality).toContain('[data-testid="assistant-thread"][data-state="empty"]');
    expect(quality).toContain("max-height: 64rem;");
    expect(quality).toContain("padding-top: clamp(2rem, 4vh, 2.75rem);");
    expect(quality).toContain("padding-bottom: clamp(3rem, 7vh, 5.5rem);");
  });
});
