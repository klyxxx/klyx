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
    expect(boundary).toContain('"KLYX_BRAIN_MESSAGE_TOO_LONG"');
    expect(composer).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(composer).toContain("maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}");
    expect(commandRoute).toContain("isKlyxAssistantMessageTooLong");
  });

  it("rejects oversized follow-ups at the bounded parser before unified intent or visible AI processing", () => {
    const postSource = converseRoute.slice(
      converseRoute.indexOf("export async function POST")
    );
    const parseIndex = postSource.indexOf(
      "parseBrainRespondRequest(boundedInspectionRequest)"
    );
    const parseFailureIndex = postSource.indexOf("if (!parsedRequest.ok)");
    const routeIndex = postSource.indexOf("routeAssistantIntent(message");
    const serviceResponseIndex = postSource.indexOf("return serviceResponse({");

    expect(parseIndex).toBeGreaterThan(-1);
    expect(parseFailureIndex).toBeGreaterThan(parseIndex);
    expect(routeIndex).toBeGreaterThan(parseFailureIndex);
    expect(serviceResponseIndex).toBeGreaterThan(parseFailureIndex);
    expect(converseRoute).toContain("await generateKlyxVisibleAiReply");
    expect(converseRoute).toMatch(
      /suppressVisibleAiForCapacity\s*=\s*isKlyxAssistantMessageTooLong\(params\.message\)/
    );
    expect(boundary).toContain(
      "rawMessage.length > BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS"
    );
  });

  it("caps speech input with the same shared capacity", () => {
    expect(composer).toContain(
      "nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)"
    );
  });
});
