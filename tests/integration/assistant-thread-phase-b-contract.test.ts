import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const thread = read("app/components/assistant/AssistantThread.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");
const turns = read("app/components/assistant/AssistantTurns.tsx");
const suggestions = read("app/components/assistant/SuggestionGroup.tsx");
const ready = read("app/components/assistant/ReadyForSearchSummary.tsx");

describe("KLYX Phase B D01-D03 thread contract", () => {
  it("keeps the thread as the product without marketplace or transactional mutations", () => {
    expect(thread).toContain('fetch("/api/brain/command"');
    expect(thread).toContain('fetch("/api/brain/converse"');

    for (const forbidden of [
      "/api/brain/confirm-request",
      "/api/brain/market-publish",
      "/recommendations",
      "/providers",
      "BrainReadinessCard",
    ]) {
      expect(thread).not.toContain(forbidden);
    }

    expect(ready).not.toContain("<button");
    expect(ready).toContain("Je peux chercher maintenant.");
  });

  it("maps structured Brain state to clarification and ready_for_search only", () => {
    expect(thread).toContain("payload?.readiness?.nextMissing");
    expect(thread).toContain("payload?.missing?.[0]");
    expect(thread).toContain("payload?.ready === true");
    expect(thread).toContain("nextPayload?.readiness?.summary");
    expect(thread).toContain('"clarification_needed"');
    expect(thread).toContain('"ready_for_search"');
    expect(thread).toContain('"typing"');
    expect(thread).toContain('"submitting"');
    expect(thread).toContain('"assistant_processing"');
  });

  it("keeps clarification conversational instead of turning missing fields into a form", () => {
    expect(thread).toContain("ClarificationTurn");
    expect(thread).toContain("clarificationSuggestions");
    expect(suggestions).toContain("suggestions.slice(0, 3)");
    expect(thread).not.toContain("Service / Ville / Date / Heure");
    expect(thread).not.toContain("grid-cols-4");
    expect(thread).toContain("void submitMessage(suggestion.value, { forceFocus: true });");
  });

  it("uses guarded async work and silently discards stale responses", () => {
    expect(thread).toContain("AbortController");
    expect(thread).toContain("requestGenerationRef");
    expect(thread).toContain("KLYX_ACTIVE_PROFILE_CHANGED");
    expect(thread).toContain("expectedProfileId");
    expect(thread).toContain("requestConversationId");
    expect(thread).toContain("controller.signal.aborted");
  });

  it("handles hardened HTTP errors without resetting the conversation or blind retry", () => {
    expect(thread).toContain("status === 400");
    expect(thread).toContain("status === 413");
    expect(thread).toContain("status === 429");
    expect(thread).not.toContain("retry(");
  });

  it("keeps conversationId as the only durable UX anchor and documents refresh limits", () => {
    expect(thread).toContain('url.searchParams.set("conversation", nextConversationId)');
    expect(thread).toContain("no transcript hydration endpoint");
    expect(thread).toContain("does not persist transcript/payload data");
    expect(thread).not.toContain("localStorage.setItem");
    expect(thread).not.toContain("/api/brain/transcript");
    expect(thread).not.toContain("/api/brain/history");
  });

  it("keeps accessibility, focus and near-bottom scrolling explicit", () => {
    expect(thread).toContain("NEAR_BOTTOM_THRESHOLD_PX = 120");
    expect(thread).toContain('role="status"');
    expect(thread).toContain('aria-live="polite"');
    expect(thread).toContain('aria-atomic="true"');
    expect(thread).toContain('role="alert"');
    expect(thread).toContain("focusMovedDuringRequestRef");
    expect(thread).toContain("shouldRestoreFocusRef");
    expect(turns).not.toContain('aria-live="polite"');
    expect(composer).toContain('data-testid="assistant-composer"');
  });
});
