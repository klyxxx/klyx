import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const commandBar = readFileSync(
  "app/components/AssistantCommandBar.tsx",
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
  it("uses one shared capacity in the client composer and first-message router", () => {
    expect(commandBar).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(commandBar).toContain(
      "maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}"
    );
    expect(commandRoute).toContain("isKlyxAssistantMessageTooLong");
    expect(commandRoute).not.toContain("rawMessage.length > 700");
    expect(commandBar).not.toContain("maxLength={700}");
  });

  it("rejects oversized follow-ups before deterministic or visible AI processing", () => {
    const guardIndex = converseRoute.indexOf(
      "isKlyxAssistantMessageTooLong(message)"
    );
    const deterministicIndex = converseRoute.indexOf(
      "deterministicPost(request)"
    );
    const visibleAiIndex = converseRoute.indexOf(
      "generateKlyxVisibleAiReply"
    );

    expect(guardIndex).toBeGreaterThan(-1);
    expect(deterministicIndex).toBeGreaterThan(guardIndex);
    expect(visibleAiIndex).toBeGreaterThan(guardIndex);
  });

  it("caps speech input with the same shared capacity", () => {
    expect(commandBar).toContain(
      "nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)"
    );
  });
});
