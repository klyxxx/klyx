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
const compactThread = thread.replace(/\s+/g, " ");

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

  it("maps the complete D01-D03 state contract to structured Brain state", () => {
    expect(thread).toContain("payload?.readiness?.nextMissing");
    expect(thread).toContain("payload?.missing?.[0]");
    expect(thread).toContain("payload?.ready === true");
    expect(thread).toContain("nextPayload?.readiness?.summary");

    for (const state of [
      "empty",
      "typing",
      "submitting",
      "user_submitted",
      "assistant_thinking",
      "assistant_replied",
      "clarification_needed",
      "user_response",
      "assistant_processing",
      "ready_for_search",
    ]) {
      expect(thread).toContain(`"${state}"`);
    }
  });

  it("keeps clarification conversational instead of turning missing fields into a form", () => {
    expect(thread).toContain("ClarificationTurn");
    expect(thread).toContain("clarificationSuggestions");
    expect(suggestions).toContain("suggestions.slice(0, 3)");
    expect(thread).not.toContain("Service / Ville / Date / Heure");
    expect(thread).not.toContain("grid-cols-4");
    expect(thread).toContain("void submitMessage(suggestion.value");
    expect(thread).toContain("forceFocus: true");
  });

  it("honors the hardened Brain boundary for first and follow-up messages", () => {
    expect(thread).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(compactThread).toContain(
      "const brainRequest = requestConversationId ? { conversationId: requestConversationId, message } : { message };"
    );
    expect(thread).toContain("body: JSON.stringify(brainRequest)");
    expect(thread).not.toContain("conversationId: null");
    expect(thread).not.toContain(
      "JSON.stringify({ conversationId: expectedConversationId"
    );
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
