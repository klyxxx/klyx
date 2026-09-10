import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("KLYX shell polish contract", () => {
  it("keeps Founder access server-gated and hidden for non-founders", () => {
    const accessBar = read("app/components/FounderAccessBar.tsx");
    const founderAuth = read("lib/founder-auth.ts");

    expect(accessBar).toContain('import { isKlyxFounder } from "@/lib/founder-auth"');
    expect(accessBar).toMatch(/const founder =\s*await isKlyxFounder\(\);/);
    expect(accessBar).toMatch(/if \(!founder\) \{\s*return null;\s*\}/);
    expect(accessBar.indexOf("if (!founder)"))
      .toBeLessThan(accessBar.indexOf("await import("));

    expect(founderAuth).toContain("await supabase.auth.getUser()");
    expect(founderAuth).toContain("configuredFounderIds().has(user.id)");
  });

  it("presents authorized Founder access as a low-hierarchy internal utility", () => {
    const accessBar = read("app/components/FounderAccessBar.tsx");
    const destinationCss = read("app/klyx-destination-system.css");

    expect(accessBar).toContain('className="klyx-founder-access-utility"');
    expect(accessBar).toContain('aria-label="Outils internes Founder"');
    expect(destinationCss).toContain(".klyx-founder-access-utility > div");
    expect(destinationCss).toContain("opacity: 0.7;");
    expect(destinationCss).toContain("border-style: dashed;");
    expect(destinationCss).toContain("height: 2rem !important;");
  });

  it("tightens only the empty assistant vertical rhythm across breakpoints", () => {
    const destinationCss = read("app/klyx-destination-system.css");

    expect(destinationCss).toContain('[data-testid="assistant-thread"][data-state="empty"]');
    expect(destinationCss).toContain("@media (min-width: 640px)");
    expect(destinationCss).toContain("@media (min-width: 1024px)");
    expect(destinationCss).toContain("max-height: 60rem;");
    expect(destinationCss).toContain("padding-top: 2rem;");
    expect(destinationCss).toContain("padding-bottom: 2rem;");
  });

  it("does not pull MissionRail into the polish layer", () => {
    const destinationCss = read("app/klyx-destination-system.css");

    expect(destinationCss).not.toContain(".MissionRail");
    expect(destinationCss).not.toContain("[data-testid=\"mission-rail\"]");
  });
});
