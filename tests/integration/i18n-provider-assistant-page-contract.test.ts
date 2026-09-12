import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const pageSource = read("app/provider/assistant/page.tsx");
const routeSource = read("app/api/provider/assistant/assistant-route-core.ts");
const boundarySource = read(
  "app/api/provider/assistant/provider-assistant-http-boundary.ts"
);
const assistantThreadSource = read(
  "app/components/assistant/AssistantThread.tsx"
);
const assistantComposerSource = read(
  "app/components/assistant/AssistantComposer.tsx"
);

describe("KLYX provider assistant compatibility and i18n safety contract", () => {
  it("keeps the provider-only API authenticated while the legacy page redirects", () => {
    expect(pageSource).toContain('redirect("/assistant")');
    expect(pageSource).not.toContain('fetch("/api/provider/assistant"');
    expect(routeSource).toContain('requireAccountType(profile, "provider")');
    expect(routeSource).toContain("parseProviderAssistantPostRequest(request)");
  });

  it("preserves bounded provider payloads and bounded shared-assistant prompt handoff", () => {
    expect(routeSource).toContain("parseProviderAssistantPostRequest(request)");
    expect(routeSource).not.toContain("body.message.trim().slice(0, 1000)");
    expect(boundarySource).toContain(
      "PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS = 1000"
    );
    expect(assistantThreadSource).toContain("initialPromptFromLocation()");
    expect(assistantThreadSource).toContain(
      ".slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)"
    );
    expect(pageSource).not.toContain("setInterval(");
    expect(pageSource).not.toContain("setTimeout(");
  });

  it("keeps apply limited to availability and other provider drafts manual-only", () => {
    expect(routeSource).toContain('if (draft.draft_type !== "availability")');
    expect(routeSource).toContain(
      "Les réponses et devis restent des brouillons à copier manuellement."
    );
    expect(routeSource).toContain('.from("availability_slots")');
  });

  it("localizes the canonical assistant instead of maintaining provider-only chrome", () => {
    expect(assistantThreadSource).toContain("useKlyxLocale()");
    expect(assistantThreadSource).toContain(
      "translateKlyxAssistantCommand(locale, key)"
    );
    expect(assistantThreadSource).toContain("translateKlyxAssistantHome");
    expect(assistantThreadSource).toContain("<AssistantComposer");
    expect(assistantComposerSource).toContain("placeholder={placeholder}");
    expect(assistantComposerSource).toContain("voiceCopy(locale)");
    expect(pageSource).not.toContain("translateKlyxProviderAssistant");
  });

  it("keeps transactional execution out of the compatibility and provider-assistant surfaces", () => {
    for (const source of [pageSource, routeSource]) {
      expect(source).not.toContain("/api/stripe");
      expect(source).not.toContain("payment_intent");
      expect(source).not.toContain("transfer");
    }
  });
});
