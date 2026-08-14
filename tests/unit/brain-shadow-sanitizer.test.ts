import {
  describe,
  expect,
  it,
} from "vitest";

import {
  sanitizeKlyxShadowForClient,
} from "../../lib/brain/shadow/shadow-sanitizer";

describe(
  "KLYX shadow client sanitizer",
  () => {
    it(
      "never exposes internal LLM text",
      () => {
        const result =
          sanitizeKlyxShadowForClient({
            attempted:
              true,

            available:
              true,

            provider:
              "openai",

            model:
              "test-model",

            intent:
              "service_request",

            confidence:
              0.94,

            text:
              "INTERNAL SECRET LLM RESPONSE",

            automaticExecutionAllowed:
              false,
          });

        expect(
          result.internalTextExposed,
        ).toBe(
          false,
        );

        expect(
          "text" in result,
        ).toBe(
          false,
        );

        expect(
          JSON.stringify(result),
        ).not.toContain(
          "INTERNAL SECRET LLM RESPONSE",
        );
      },
    );

    it(
      "never exposes provider errors",
      () => {
        const result =
          sanitizeKlyxShadowForClient({
            attempted:
              true,

            available:
              true,

            error:
              "private provider failure",

            automaticExecutionAllowed:
              false,
          });

        expect(
          "error" in result,
        ).toBe(
          false,
        );

        expect(
          JSON.stringify(result),
        ).not.toContain(
          "private provider failure",
        );
      },
    );

    it(
      "keeps automatic execution disabled",
      () => {
        const result =
          sanitizeKlyxShadowForClient({
            attempted:
              true,

            available:
              true,

            automaticExecutionAllowed:
              false,
          });

        expect(
          result.automaticExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );

    it(
      "can expose safe comparison metadata",
      () => {
        const result =
          sanitizeKlyxShadowForClient({
            attempted:
              true,

            available:
              true,

            provider:
              "openai",

            model:
              "test-model",

            intent:
              "recommendation",

            confidence:
              0.88,

            agreementWithExpectedIntent:
              true,

            automaticExecutionAllowed:
              false,
          });

        expect(
          result.intent,
        ).toBe(
          "recommendation",
        );

        expect(
          result.confidence,
        ).toBe(
          0.88,
        );

        expect(
          result.agreementWithDeterministicBrain,
        ).toBe(
          true,
        );
      },
    );
  },
);