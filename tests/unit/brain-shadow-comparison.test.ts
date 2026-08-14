import {
  describe,
  expect,
  it,
} from "vitest";

import {
  compareKlyxBrainWithShadow,
} from "../../lib/brain/shadow/shadow-comparison";

describe(
  "KLYX Brain shadow comparison",
  () => {
    it(
      "detects intent agreement",
      () => {
        const result =
          compareKlyxBrainWithShadow({
            deterministicIntent:
              "service_request",

            shadowIntent:
              "service_request",

            shadowConfidence:
              0.94,

            shadowAvailable:
              true,

            shadowAttempted:
              true,
          });

        expect(
          result.comparable,
        ).toBe(
          true,
        );

        expect(
          result.agreement,
        ).toBe(
          true,
        );

        expect(
          result.confidenceBucket,
        ).toBe(
          "high",
        );
      },
    );

    it(
      "detects disagreement without changing authority",
      () => {
        const result =
          compareKlyxBrainWithShadow({
            deterministicIntent:
              "service_request",

            shadowIntent:
              "recommendation",

            shadowConfidence:
              0.86,

            shadowAvailable:
              true,

            shadowAttempted:
              true,
          });

        expect(
          result.agreement,
        ).toBe(
          false,
        );

        expect(
          result.canInfluenceUserReply,
        ).toBe(
          false,
        );
      },
    );

    it(
      "is not comparable when shadow is unavailable",
      () => {
        const result =
          compareKlyxBrainWithShadow({
            deterministicIntent:
              "service_request",

            shadowIntent:
              null,

            shadowConfidence:
              null,

            shadowAvailable:
              false,

            shadowAttempted:
              false,
          });

        expect(
          result.comparable,
        ).toBe(
          false,
        );

        expect(
          result.agreement,
        ).toBeNull();
      },
    );

    it(
      "never allows automatic execution",
      () => {
        const result =
          compareKlyxBrainWithShadow({
            deterministicIntent:
              "service_request",

            shadowIntent:
              "service_request",

            shadowConfidence:
              1,

            shadowAvailable:
              true,

            shadowAttempted:
              true,
          });

        expect(
          result.automaticExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          result.canInfluenceUserReply,
        ).toBe(
          false,
        );
      },
    );
  },
);