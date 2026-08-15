import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildKlyxBrainLocalStats,
} from "../../lib/brain/analytics/brain-local-stats";

describe(
  "KLYX Brain local statistics",
  () => {
    it(
      "computes readiness and understanding rates",
      () => {
        const result =
          buildKlyxBrainLocalStats([
            {
              ready:
                true,

              missing:
                [],

              understood:
                true,

              ambiguous:
                false,

              completeness:
                1,
            },

            {
              ready:
                false,

              missing:
                [
                  "city",
                ],

              understood:
                true,

              ambiguous:
                false,

              completeness:
                0.75,
            },
          ]);

        expect(
          result.totalSamples,
        ).toBe(
          2,
        );

        expect(
          result.readyRate,
        ).toBe(
          0.5,
        );

        expect(
          result.understoodRate,
        ).toBe(
          1,
        );
      },
    );

    it(
      "counts missing fields",
      () => {
        const result =
          buildKlyxBrainLocalStats([
            {
              ready:
                false,

              missing:
                [
                  "city",
                  "budget",
                ],

              understood:
                true,

              ambiguous:
                false,

              completeness:
                0.5,
            },

            {
              ready:
                false,

              missing:
                [
                  "city",
                ],

              understood:
                false,

              ambiguous:
                true,

              completeness:
                0.25,
            },
          ]);

        expect(
          result.missingFieldFrequency.city,
        ).toBe(
          2,
        );

        expect(
          result.missingFieldFrequency.budget,
        ).toBe(
          1,
        );
      },
    );

    it(
      "computes ambiguity and completeness",
      () => {
        const result =
          buildKlyxBrainLocalStats([
            {
              ready:
                true,

              missing:
                [],

              understood:
                true,

              ambiguous:
                false,

              completeness:
                1,
            },

            {
              ready:
                false,

              missing:
                [
                  "date",
                ],

              understood:
                false,

              ambiguous:
                true,

              completeness:
                0.5,
            },
          ]);

        expect(
          result.ambiguityRate,
        ).toBe(
          0.5,
        );

        expect(
          result.averageCompleteness,
        ).toBe(
          0.75,
        );
      },
    );

    it(
      "works safely with zero samples",
      () => {
        const result =
          buildKlyxBrainLocalStats(
            [],
          );

        expect(
          result.totalSamples,
        ).toBe(
          0,
        );

        expect(
          result.readyRate,
        ).toBe(
          0,
        );

        expect(
          result.averageCompleteness,
        ).toBe(
          0,
        );
      },
    );

    it(
      "never requires paid APIs or automatic execution",
      () => {
        const result =
          buildKlyxBrainLocalStats(
            [],
          );

        expect(
          result.externalApiRequired,
        ).toBe(
          false,
        );

        expect(
          result.automaticExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);