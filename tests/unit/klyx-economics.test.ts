import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateKlyxEconomics,
} from "../../lib/klyx-economics";

// KLYX_ECONOMICS_TESTS_13_29

describe(
  "KLYX payment economics",
  () => {
    it(
      "calculates the default 15 percent commission exactly",
      () => {
        const result =
          calculateKlyxEconomics(
            10_000,
            15
          );

        expect(
          result.grossAmountCents
        ).toBe(
          10_000
        );

        expect(
          result.platformFeeCents
        ).toBe(
          1_500
        );

        expect(
          result.providerAmountCents
        ).toBe(
          8_500
        );

        expect(
          result.platformFeeCents +
          result.providerAmountCents
        ).toBe(
          result.grossAmountCents
        );
      }
    );

    it(
      "supports zero commission without losing money",
      () => {
        const result =
          calculateKlyxEconomics(
            12_345,
            0
          );

        expect(
          result.platformFeeCents
        ).toBe(
          0
        );

        expect(
          result.providerAmountCents
        ).toBe(
          12_345
        );
      }
    );

    it(
      "supports one hundred percent commission deterministically",
      () => {
        const result =
          calculateKlyxEconomics(
            5_000,
            100
          );

        expect(
          result.platformFeeCents
        ).toBe(
          5_000
        );

        expect(
          result.providerAmountCents
        ).toBe(
          0
        );
      }
    );

    it(
      "rounds commission in integer cents",
      () => {
        const result =
          calculateKlyxEconomics(
            999,
            15
          );

        expect(
          result.platformFeeCents
        ).toBe(
          150
        );

        expect(
          result.providerAmountCents
        ).toBe(
          849
        );

        expect(
          Number.isInteger(
            result.platformFeeCents
          )
        ).toBe(
          true
        );
      }
    );

    it(
      "rejects negative gross amounts",
      () => {
        expect(
          () =>
            calculateKlyxEconomics(
              -1,
              15
            )
        ).toThrow();
      }
    );

    it(
      "rejects non integer cent values",
      () => {
        expect(
          () =>
            calculateKlyxEconomics(
              100.5,
              15
            )
        ).toThrow();
      }
    );

    it(
      "rejects commission below zero",
      () => {
        expect(
          () =>
            calculateKlyxEconomics(
              10_000,
              -1
            )
        ).toThrow();
      }
    );

    it(
      "rejects commission above one hundred",
      () => {
        expect(
          () =>
            calculateKlyxEconomics(
              10_000,
              101
            )
        ).toThrow();
      }
    );
  }
);