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

  it("keeps follow-up capacity authoritative in /respond before any Visible AI pass", () => {
    const deterministicIndex = converseRoute.indexOf(
      "deterministicPost(request)"
    );
    const errorGateIndex = converseRoute.indexOf("if (!response.ok)");
    const boundedParseIndex = converseRoute.indexOf(
      "await parseBrainRespondRequest(visibleAiRequest)"
    );
    const visibleAiIndex = converseRoute.indexOf(
      "await generateKlyxVisibleAiReply"
    );

    expect(converseRoute).not.toContain(
      "isKlyxAssistantMessageTooLong(message)"
    );
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(errorGateIndex).toBeGreaterThan(deterministicIndex);
    expect(boundedParseIndex).toBeGreaterThan(errorGateIndex);
    expect(visibleAiIndex).toBeGreaterThan(boundedParseIndex);
  });

  it("caps speech input with the same shared capacity", () => {
    expect(commandBar).toContain(
      "nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)"
    );
  });
});
