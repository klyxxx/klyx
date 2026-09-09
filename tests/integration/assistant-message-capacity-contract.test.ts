import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const composer = readFileSync(
  "app/components/assistant/AssistantComposer.tsx",
  "utf8"
);
const limits = readFileSync(
  "lib/klyx-assistant-message-limits.ts",
  "utf8"
);
const boundary = readFileSync(
  "lib/brain/respond-http-boundary.ts",
  "utf8"
);
const commandRoute = readFileSync(
  "app/api/brain/command/route.ts",
  "utf8"
);
const converseRoute = readFileSync(
  "app/api/brain/converse/route.ts",
  "utf8"
);

describe("assistant message capacity contract", () => {
  it("aligns the shared visible capacity to the hardened 4,000-character Brain boundary", () => {
    expect(limits).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH = 4000");
    expect(boundary).toContain("BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS = 4000");
    expect(composer).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(composer).toContain("maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}");
    expect(commandRoute).toContain("isKlyxAssistantMessageTooLong");
  });

  it("rejects oversized follow-ups before deterministic or visible AI processing", () => {
    const guardIndex = converseRoute.indexOf(
      "isKlyxAssistantMessageTooLong(message)"
    );
    const deterministicIndex = converseRoute.indexOf(
      "deterministicPost(request)"
    );
    const visibleAiIndex = converseRoute.indexOf(
      "await generateKlyxVisibleAiReply"
    );

    expect(guardIndex).toBeGreaterThan(-1);
    expect(deterministicIndex).toBeGreaterThan(guardIndex);
    expect(visibleAiIndex).toBeGreaterThan(guardIndex);
  });

  it("caps speech input with the same shared capacity", () => {
    expect(composer).toContain(
      "nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)"
    );
  });
});
