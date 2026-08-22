import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assessKlyxMarketReadiness,
  getKlyxMarketReadiness,
  isKlyxMarketCommerciallyReady,
  listKlyxMarketReadiness,
  type KlyxMarketReadiness,
} from "../../lib/klyx-market-readiness";
import {
  KLYX_SUPPORTED_MARKETS,
} from "../../lib/klyx-supported-markets";

function provenDimension() {
  return {
    status: "verified" as const,
    verifiedAt: "2026-08-22",
    sourceRef: "official-source-ref",
    note: null,
  };
}

function fullyProvenMarket(): KlyxMarketReadiness {
  return {
    countryCode: "BE",
    countryName: "Belgique",
    currencyCode: "EUR",
    monetarySupport: "supported",
    stripeConnect: provenDimension(),
    kyc: provenDimension(),
    tax: provenDimension(),
    regulatedCategories: provenDimension(),
    launchDecision: {
      status: "open",
      decidedAt: "2026-08-22",
      evidenceRef: "launch-decision-ref",
    },
  };
}

describe("KLYX market readiness governance", () => {
  it("does not equate monetary support with commercial readiness", () => {
    const belgium = getKlyxMarketReadiness("BE");

    expect(belgium.monetarySupport).toBe("supported");
    expect(belgium.currencyCode).toBe("EUR");
    expect(belgium.launchDecision.status).toBe("closed");
    expect(isKlyxMarketCommerciallyReady("BE")).toBe(false);
  });

  it("fails closed for unknown markets", () => {
    const unknown = getKlyxMarketReadiness("ZZ");
    const assessment = assessKlyxMarketReadiness(unknown);

    expect(unknown.monetarySupport).toBe("unsupported");
    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("monetary_support");
  });

  it("requires every readiness dimension plus an explicit launch decision", () => {
    const assessment = assessKlyxMarketReadiness(fullyProvenMarket());

    expect(assessment.ready).toBe(true);
    expect(assessment.blockers).toEqual([]);
  });

  it("rejects a verified-looking dimension without dated evidence", () => {
    const readiness = fullyProvenMarket();

    readiness.kyc = {
      status: "verified",
      verifiedAt: null,
      sourceRef: "official-source-ref",
      note: null,
    };

    const assessment = assessKlyxMarketReadiness(readiness);

    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("kyc");
  });

  it("requires evidence even when a dimension is not applicable", () => {
    const readiness = fullyProvenMarket();

    readiness.tax = {
      status: "not_applicable",
      verifiedAt: "2026-08-22",
      sourceRef: null,
      note: "Needs evidence explaining why this is not applicable.",
    };

    const assessment = assessKlyxMarketReadiness(readiness);

    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain("tax");
  });

  it("keeps every monetary catalogue entry closed until explicitly proven", () => {
    const readiness = listKlyxMarketReadiness();

    expect(readiness).toHaveLength(KLYX_SUPPORTED_MARKETS.length);
    expect(readiness.every((market) => market.monetarySupport === "supported")).toBe(true);
    expect(readiness.every((market) => market.launchDecision.status === "closed")).toBe(true);
    expect(readiness.every((market) => !assessKlyxMarketReadiness(market).ready)).toBe(true);
  });
});
