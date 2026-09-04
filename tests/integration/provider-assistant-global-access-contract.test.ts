import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("provider assistant global access contract", () => {
  it("keeps the fixed provider navigation unchanged while exposing KLYX assistant separately", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");
    const providerItemsBlock = sidebar.slice(
      sidebar.indexOf("const providerItems"),
      sidebar.indexOf("const PROVIDER_ASSISTANT_HREF")
    );

    expect(providerItemsBlock).toContain('title: "Missions"');
    expect(providerItemsBlock).toContain('title: "Services"');
    expect(providerItemsBlock).toContain('title: "Finances"');
    expect(providerItemsBlock).toContain('title: "Profil"');
    expect(providerItemsBlock).not.toContain("Assistant KLYX");
    expect(providerItemsBlock).not.toContain("/provider/assistant");

    expect(sidebar).toContain(
      'const PROVIDER_ASSISTANT_HREF = "/provider/assistant"'
    );
    expect(sidebar).toContain('data-testid="provider-assistant-launcher-desktop"');
    expect(sidebar).toContain('data-testid="provider-assistant-launcher-mobile"');
    expect(sidebar).toContain('accountType === "provider"');
    expect(sidebar).toContain("providerAssistantActive");
  });

  it("keeps the assistant launcher available from provider screens without changing the four-tab mobile grid", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");

    expect(sidebar).toContain('data-testid="mobile-navigation"');
    expect(sidebar).toContain("grid-cols-4");
    expect(sidebar).toContain("bottom-[calc(5.25rem+env(safe-area-inset-bottom))]");
    expect(sidebar).toContain(
      'translateKlyxProviderAssistant(locale, "badge")'
    );
    expect(sidebar).toContain("{providerAssistantLabel}");
    expect(sidebar).toContain("aria-label={providerAssistantLabel}");
    expect(sidebar).not.toContain('aria-label="Assistant KLYX"');
  });
});
