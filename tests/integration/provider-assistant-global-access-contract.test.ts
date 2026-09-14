import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("unified assistant global access contract", () => {
  it("keeps one assistant destination for every legacy account capability", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");
    const accountHome = read("lib/account-home.ts");
    const legacyProviderAssistant = read("app/provider/assistant/page.tsx");

    expect(sidebar).toContain('href: "/assistant"');
    expect(sidebar).not.toContain('"/provider/assistant"');
    expect(sidebar).not.toContain("accountType");
    expect(sidebar).not.toContain("providerItems");
    expect(sidebar).not.toContain("clientItems");

    expect(accountHome).toContain('client: "/assistant"');
    expect(accountHome).toContain('provider: "/assistant"');
    expect(legacyProviderAssistant).toContain('redirect("/assistant")');
  });

  it("keeps the same four-tab mobile grid for all users", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain('data-testid="mobile-navigation"');
    expect(sidebar).toContain("grid-cols-4");
    expect(sidebar).toContain('title: "KLYX"');
    expect(sidebar).toContain('title: "Activité"');
    expect(sidebar).toContain('title: "Messages"');
    expect(sidebar).toContain('title: "Profil"');
    expect(sidebar).not.toContain("provider-assistant-launcher");
  });
});
