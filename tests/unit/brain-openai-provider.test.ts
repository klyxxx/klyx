import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseOpenAiStructuredResult,
} from "../../lib/brain/llm/openai-structured";

import {
  createKlyxLlmSafety,
} from "../../lib/brain/llm/safety";

describe(
  "KLYX OpenAI structured output",
  () => {
    it(
      "parses a valid structured response",
      () => {
        const result =
          parseOpenAiStructuredResult(
            JSON.stringify({
              text:
                "Je peux vous aider à organiser ce service.",

              intent:
                "service_request",

              confidence:
                0.93,
            }),
          );

        expect(
          result.intent,
        ).toBe(
          "service_request",
        );

        expect(
          result.confidence,
        ).toBe(
          0.93,
        );

        expect(
          result.text.length,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "normalizes an invalid intent",
      () => {
        const result =
          parseOpenAiStructuredResult(
            JSON.stringify({
              text:
                "Réponse.",

              intent:
                "execute_payment",

              confidence:
                1,
            }),
          );

        expect(
          result.intent,
        ).toBe(
          "unknown",
        );
      },
    );

    it(
      "clamps confidence",
      () => {
        const result =
          parseOpenAiStructuredResult(
            JSON.stringify({
              text:
                "Réponse.",

              intent:
                "conversation",

              confidence:
                9,
            }),
          );

        expect(
          result.confidence,
        ).toBe(
          1,
        );
      },
    );

    it(
      "rejects an empty text response",
      () => {
        expect(() =>
          parseOpenAiStructuredResult(
            JSON.stringify({
              text:
                "",

              intent:
                "conversation",

              confidence:
                0.5,
            }),
          ),
        ).toThrow();
      },
    );

    it(
      "still forbids automatic execution",
      () => {
        const safety =
          createKlyxLlmSafety();

        expect(
          safety.automaticExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          safety.requiresExplicitConfirmation,
        ).toBe(
          true,
        );
      },
    );
  },
);