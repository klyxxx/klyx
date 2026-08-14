import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createKlyxShadowObservation,
} from "../../lib/brain/shadow/shadow-observation";

import type {
  KlyxShadowResult,
} from "../../lib/brain/shadow/llm-shadow";

describe(
  "KLYX LLM shadow mode",
  () => {
    it(
      "never enables automatic execution",
      () => {
        const result:
          KlyxShadowResult =
          {
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
              0.9,

            text:
              "Shadow response",

            agreementWithExpectedIntent:
              true,

            automaticExecutionAllowed:
              false,

            error:
              null,
          };

        const observation =
          createKlyxShadowObservation(
            "test",
            "service_request",
            result,
          );

        expect(
          observation.shadow
            .automaticExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );

    it(
      "records intent agreement",
      () => {
        const result:
          KlyxShadowResult =
          {
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
              0.82,

            text:
              "Shadow response",

            agreementWithExpectedIntent:
              true,

            automaticExecutionAllowed:
              false,

            error:
              null,
          };

        const observation =
          createKlyxShadowObservation(
            "test",
            "recommendation",
            result,
          );

        expect(
          observation.shadow
            .agreementWithExpectedIntent,
        ).toBe(
          true,
        );
      },
    );

    it(
      "records provider failure safely",
      () => {
        const result:
          KlyxShadowResult =
          {
            attempted:
              true,

            available:
              true,

            provider:
              "openai",

            model:
              "test-model",

            intent:
              null,

            confidence:
              null,

            text:
              null,

            agreementWithExpectedIntent:
              null,

            automaticExecutionAllowed:
              false,

            error:
              "timeout",
          };

        const observation =
          createKlyxShadowObservation(
            "test",
            "conversation",
            result,
          );

        expect(
          observation.shadow.error,
        ).toBe(
          "timeout",
        );

        expect(
          observation.shadow
            .automaticExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);