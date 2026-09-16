import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

const legacyPage = read("app/provider/assistant/page.tsx");
const thread = read("app/components/assistant/AssistantThread.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");
const routeSource = read("app/api/provider/assistant/assistant-route-core.ts");
const boundarySource = read(
  "app/api/provider/assistant/provider-assistant-http-boundary.ts"
);

describe("KLYX provider assistant migration safety contract", () => {
  it("keeps only one visible assistant destination", () => {
    expect(legacyPage).toContain('redirect("/assistant")');
    expect(thread).toContain('fetch("/api/brain/converse"');
    expect(thread).not.toContain('fetch("/api/provider/assistant"');
  });

  it("preserves bounded explicit input on the unified composer and legacy API", () => {
    expect(composer).toContain("maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}");
    expect(composer).toContain("onSubmit={submit}");
    expect(routeSource).toContain("parseProviderAssistantPostRequest(request)");
    expect(boundarySource).toContain(
      "PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS = 1000"
    );
  });

  it("keeps legacy provider draft application narrow and server-authoritative", () => {
    expect(routeSource).toContain('if (draft.draft_type !== "availability")');
    expect(routeSource).toContain(
      "Les réponses et devis restent des brouillons à copier manuellement."
    );
    expect(routeSource).toContain('.from("availability_slots")');
    expect(routeSource).toContain('.from("provider_assistant_drafts")');
  });

  it("keeps the unified surface localized and non-transactional", () => {
    expect(thread).toContain("useKlyxLocale()");
    expect(thread).toContain("translateKlyxAssistantCommand");
    expect(composer).toContain("placeholder={placeholder}");
    expect(thread).not.toContain("/api/stripe");
    expect(thread).not.toContain("/api/bookings");
  });
});
