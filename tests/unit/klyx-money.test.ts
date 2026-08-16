import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assertKlyxSameCurrency,
  formatKlyxMoney,
  fromKlyxMinorUnits,
  getKlyxStripeCurrency,
  resolveKlyxMoneyContext,
  resolveKlyxProfileMoney,
  toKlyxMinorUnits,
} from "../../lib/klyx-money";

// KLYX_MONEY_CONTRACT_TESTS_14_22

describe(
  "KLYX global money contract",
  () => {
    it(
      "resolves Belgium to EUR",
      () => {
        const result =
          resolveKlyxMoneyContext(
            "BE",
            "EUR"
          );

        expect(
          result.currencyCode
        ).toBe("EUR");

        expect(
          result.stripeCurrency
        ).toBe("eur");
      }
    );

    it(
      "resolves United States to USD",
      () => {
        const result =
          resolveKlyxMoneyContext(
            "US",
            "USD"
          );

        expect(
          result.currencyCode
        ).toBe("USD");

        expect(
          result.stripeCurrency
        ).toBe("usd");
      }
    );

    it(
      "resolves Canada to CAD instead of generic USD",
      () => {
        const result =
          resolveKlyxMoneyContext(
            "CA",
            "CAD"
          );

        expect(
          result.currencyCode
        ).toBe("CAD");

        expect(
          result.stripeCurrency
        ).toBe("cad");
      }
    );

    it(
      "resolves Australia to AUD",
      () => {
        const result =
          resolveKlyxMoneyContext(
            "AU",
            "AUD"
          );

        expect(
          result.currencyCode
        ).toBe("AUD");
      }
    );

    it(
      "rejects Canada with USD",
      () => {
        expect(
          () =>
            resolveKlyxMoneyContext(
              "CA",
              "USD"
            )
        ).toThrow(
          "KLYX_CURRENCY_MARKET_MISMATCH"
        );
      }
    );

    it(
      "rejects unsupported markets",
      () => {
        expect(
          () =>
            resolveKlyxMoneyContext(
              "ZZ",
              "USD"
            )
        ).toThrow(
          "KLYX_MARKET_NOT_SUPPORTED"
        );
      }
    );

    it(
      "requires country and currency on transactional profiles",
      () => {
        expect(
          () =>
            resolveKlyxProfileMoney({
              countryCode: null,
              currencyCode: null,
            })
        ).toThrow(
          "KLYX_PROFILE_MARKET_REQUIRED"
        );
      }
    );

    it(
      "converts EUR major units to minor units",
      () => {
        expect(
          toKlyxMinorUnits(
            12.34,
            "BE",
            "EUR"
          )
        ).toBe(1234);
      }
    );

    it(
      "converts minor units back to major units",
      () => {
        expect(
          fromKlyxMinorUnits(
            1234,
            "BE",
            "EUR"
          )
        ).toBe(12.34);
      }
    );

    it(
      "returns lowercase Stripe currency",
      () => {
        expect(
          getKlyxStripeCurrency(
            "CA",
            "CAD"
          )
        ).toBe("cad");
      }
    );

    it(
      "rejects cross-currency transactions",
      () => {
        expect(
          () =>
            assertKlyxSameCurrency(
              "EUR",
              "USD"
            )
        ).toThrow(
          "KLYX_TRANSACTION_CURRENCY_MISMATCH"
        );
      }
    );

    it(
      "accepts identical transaction currencies",
      () => {
        expect(
          assertKlyxSameCurrency(
            "eur",
            "EUR"
          )
        ).toBe("EUR");
      }
    );

    it(
      "formats using the market currency",
      () => {
        const formatted =
          formatKlyxMoney(
            25,
            "BE",
            "EUR",
            "fr-BE"
          );

        expect(
          formatted
        ).toContain("25");

        expect(
          formatted
        ).toContain("€");
      }
    );

    it(
      "rejects negative amounts",
      () => {
        expect(
          () =>
            toKlyxMinorUnits(
              -1,
              "BE",
              "EUR"
            )
        ).toThrow(
          "KLYX_MONEY_AMOUNT_INVALID"
        );
      }
    );
  }
);