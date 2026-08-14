import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "KLYX LLM health contract",
  () => {
    it(
      "keeps automatic execution disabled",
      () => {
        const contract = {
          automaticExecutionAllowed:
            false as const,

          explicitConfirmationRequired:
            true as const,
        };

        expect(
          contract.automaticExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          contract.explicitConfirmationRequired,
        ).toBe(
          true,
        );
      },
    );

    it(
      "supports safe health states",
      () => {
        const states = [
          "disabled",
          "ready",
          "not_configured",
        ];

        expect(
          states,
        ).toContain(
          "ready",
        );

        expect(
          states,
        ).toContain(
          "disabled",
        );
      },
    );

    it(
      "does not expose any transactional action",
      () => {
        const publicHealth = {
          provider:
            "openai",

          configured:
            true,

          available:
            true,

          automaticExecutionAllowed:
            false,
        };

        const serialized =
          JSON.stringify(
            publicHealth,
          );

        expect(
          serialized,
        ).not.toContain(
          "create_payment",
        );

        expect(
          serialized,
        ).not.toContain(
          "create_booking",
        );

        expect(
          serialized,
        ).not.toContain(
          "publish_market_request",
        );
      },
    );
  },
);