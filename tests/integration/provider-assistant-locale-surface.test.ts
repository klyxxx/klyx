import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const legacyPage = read("app/provider/assistant/page.tsx");
const assistantThread = read("app/components/assistant/AssistantThread.tsx");
const providerRoute = read("app/api/provider/assistant/assistant-route-core.ts");

describe("provider assistant compatibility surface", () => {
  it("redirects the legacy provider destination into the localized shared assistant", () => {
    expect(legacyPage).toContain('redirect("/assistant")');
    expect(assistantThread).toContain("useKlyxLocale()");
    expect(assistantThread).toContain("translateKlyxAssistantCommand(locale, key)");
    expect(assistantThread).toContain("translateKlyxAssistantHome");
    expect(assistantThread).toContain("initialPromptFromLocation()");
    expect(assistantThread).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
  });

  it("does not reintroduce the retired provider-only assistant chrome", () => {
    expect(legacyPage).not.toContain("Que dois-je préparer pour ton activité ?");
    expect(legacyPage).not.toContain("Conversation avec KLYX");
    expect(legacyPage).not.toContain("Brouillons à vérifier");
    expect(legacyPage).not.toContain("Demander à KLYX…");
    expect(legacyPage).not.toContain('fetch("/api/provider/assistant"');
  });

  it("preserves provider-only draft action boundaries behind the server API", () => {
    expect(providerRoute).toContain('requireAccountType(profile, "provider")');
    expect(providerRoute).toContain("parseProviderAssistantPostRequest(request)");
    expect(providerRoute).toContain('if (draft.draft_type !== "availability")');
    expect(providerRoute).toContain('.from("availability_slots")');
  });
});
