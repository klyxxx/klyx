import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
  assertNoAutomaticExecution,
  createKlyxLlmSafety,
} from "../../lib/brain/llm/safety";

describe(
  "KLYX Brain LLM safety foundation",
  () => {
    it(
      "never allows automatic execution",
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

        expect(() =>
          assertNoAutomaticExecution(
            safety,
          ),
        ).not.toThrow();
      },
    );

    it(
      "protects every transactional action",
      () => {
        expect(
          KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
        ).toContain(
          "publish_market_request",
        );

        expect(
          KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
        ).toContain(
          "select_provider",
        );

        expect(
          KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
        ).toContain(
          "create_booking",
        );

        expect(
          KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
        ).toContain(
          "create_payment",
        );

        expect(
          KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
        ).toContain(
          "refund_payment",
        );
      },
    );

    it(
      "cannot accidentally enable automatic execution",
      () => {
        const unsafe =
          {
            automaticExecutionAllowed:
              true,

            requiresExplicitConfirmation:
              false,

            forbiddenAutomaticActions:
              [],
          };

        expect(() =>
          assertNoAutomaticExecution(
            unsafe as never,
          ),
        ).toThrow();
      },
    );
  },
);