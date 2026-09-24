export type FinanceRoundingMode = "half_up";

export type CurrencyPolicy = {
  code: string;
  minorUnitExponent: number;
};

export type CurrencyCatalog = readonly CurrencyPolicy[];

export type Money = {
  amountMinor: number;
  currency: string;
};

export type FxRate = {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  numerator: string;
  denominator: string;
};

export type CommissionPolicy = {
  basisPoints: number;
  fixedMinor?: number;
};

export type TaxRule = {
  id: string;
  basis: "gross" | "commission";
  bearer: "platform" | "provider";
  basisPoints: number;
};

export type AppliedTax = TaxRule & {
  amountMinor: number;
};

export type FinancialMovementType =
  | "charge"
  | "commission"
  | "provider_liability"
  | "transfer"
  | "reversal"
  | "refund";

export type FinancialEvent = {
  id: string;
  operationId: string;
  sequence: number;
  type: FinancialMovementType;
  amountMinor: number;
  currency: string;
  cause: string;
  details: Readonly<Record<string, string | number | boolean | null>>;
};

export type FinancialBreakdown = {
  grossMinor: number;
  commissionMinor: number;
  platformTaxMinor: number;
  providerTaxMinor: number;
  platformNetMinor: number;
  providerLiabilityMinor: number;
  taxes: readonly AppliedTax[];
};

export type RefundAllocation = {
  refundMinor: number;
  commissionRefundMinor: number;
  providerLiabilityRefundMinor: number;
  providerTaxRefundMinor: number;
  platformTaxRefundMinor: number;
};

export type FinancialState = {
  version: 1;
  transactionId: string;
  currency: string;
  breakdown: FinancialBreakdown;
  refundedMinor: number;
  commissionRefundedMinor: number;
  providerLiabilityRefundedMinor: number;
  providerTaxRefundedMinor: number;
  platformTaxRefundedMinor: number;
  transferredMinor: number;
  reversedMinor: number;
  operationIds: readonly string[];
  events: readonly FinancialEvent[];
};

export type PayoutProjection = {
  id: string;
  transactionId: string;
  type: "payout";
  currency: string;
  amountMinor: number;
  basisSequence: number;
};
