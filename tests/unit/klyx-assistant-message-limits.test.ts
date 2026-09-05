import { describe, expect, it } from "vitest";

import {
  KLYX_ASSISTANT_MESSAGE_MAX_LENGTH,
  isKlyxAssistantMessageTooLong,
} from "@/lib/klyx-assistant-message-limits";

describe("KLYX assistant message capacity", () => {
  it("allows detailed service requests up to the shared product boundary", () => {
    expect(KLYX_ASSISTANT_MESSAGE_MAX_LENGTH).toBe(5000);
    expect(
      isKlyxAssistantMessageTooLong(
        "a".repeat(KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)
      )
    ).toBe(false);
  });

  it("keeps a finite abuse boundary above the supported capacity", () => {
    expect(
      isKlyxAssistantMessageTooLong(
        "a".repeat(KLYX_ASSISTANT_MESSAGE_MAX_LENGTH + 1)
      )
    ).toBe(true);
  });

  it("measures the trimmed message users actually submit", () => {
    expect(
      isKlyxAssistantMessageTooLong(
        `  ${"a".repeat(KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)}  `
      )
    ).toBe(false);
  });
});
