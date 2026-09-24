import {
  assertFinanceBasisPoints,
  calculateBasisPointsAmount,
  requiredFinanceText,
  safeNonNegativeFinanceInteger,
} from "./math";
import type {
  CommissionPolicy,
  FinancialBreakdown,
  TaxRule,
} from "./types";

function validateTaxRules(rules: readonly TaxRule[]): readonly TaxRule[] {
  const ids = new Set<string>();

  return rules.map((rule) => {
    const id = requiredFinanceText(rule.id, "KLYX_FINANCE_TAX_ID_REQUIRED");
    if (ids.has(id)) throw new Error("KLYX_FINANCE_TAX_ID_DUPLICATE");
    ids.add(id);

    assertFinanceBasisPoints(rule.basisPoints);
    if (rule.basis !== "gross" && rule.basis !== "commission") {
      throw new Error("KLYX_FINANCE_TAX_BASIS_INVALID");
    }
    if (rule.bearer !== "platform" && rule.bearer !== "provider") {
      throw new Error("KLYX_FINANCE_TAX_BEARER_INVALID");
    }

    return { ...rule, id };
  });
}

export function calculateFinancialBreakdown(input: {
  grossMinor: number;
  commission: CommissionPolicy;
  taxes?: readonly TaxRule[];
}): FinancialBreakdown {
  const grossMinor = safeNonNegativeFinanceInteger(
    input.grossMinor,
    "KLYX_FINANCE_GROSS_INVALID"
  );
  if (grossMinor === 0) throw new Error("KLYX_FINANCE_GROSS_ZERO");

  const commissionMinor =
    calculateBasisPointsAmount(
      grossMinor,
      assertFinanceBasisPoints(input.commission.basisPoints)
    ) +
    safeNonNegativeFinanceInteger(
      input.commission.fixedMinor ?? 0,
      "KLYX_FINANCE_COMMISSION_FIXED_INVALID"
    );

  if (!Number.isSafeInteger(commissionMinor) || commissionMinor > grossMinor) {
    throw new Error("KLYX_FINANCE_COMMISSION_EXCEEDS_GROSS");
  }

  const taxes = validateTaxRules(input.taxes ?? []).map((rule) => ({
    ...rule,
    amountMinor: calculateBasisPointsAmount(
      rule.basis === "gross" ? grossMinor : commissionMinor,
      rule.basisPoints
    ),
  }));

  const platformTaxMinor = taxes
    .filter((tax) => tax.bearer === "platform")
    .reduce((sum, tax) => sum + tax.amountMinor, 0);
  const providerTaxMinor = taxes
    .filter((tax) => tax.bearer === "provider")
    .reduce((sum, tax) => sum + tax.amountMinor, 0);

  if (platformTaxMinor > commissionMinor) {
    throw new Error("KLYX_FINANCE_PLATFORM_TAX_EXCEEDS_COMMISSION");
  }
  if (commissionMinor + providerTaxMinor > grossMinor) {
    throw new Error("KLYX_FINANCE_PROVIDER_TAX_EXCEEDS_AVAILABLE_GROSS");
  }

  return {
    grossMinor,
    commissionMinor,
    platformTaxMinor,
    providerTaxMinor,
    platformNetMinor: commissionMinor - platformTaxMinor,
    providerLiabilityMinor: grossMinor - commissionMinor - providerTaxMinor,
    taxes,
  };
}
