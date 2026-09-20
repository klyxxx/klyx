import { NextResponse } from "next/server";

import {
  decimalToKlyxMinorUnits,
  klyxMinorUnitsToDecimalString,
  normalizeKlyxCountryCode,
  normalizeKlyxCurrencyCode,
} from "@/lib/klyx-currency";
import {
  calculateKlyxMarketEconomics,
} from "@/lib/klyx-market-policy";
import {
  resolveKlyxMarketPaymentPolicy,
} from "@/lib/klyx-market-policy-server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const amountText =
      url.searchParams.get("amount")?.trim() ?? "100";
    const payerCountryCode = normalizeKlyxCountryCode(
      url.searchParams.get("payerCountryCode") ?? ""
    );
    const executionCountryCode = normalizeKlyxCountryCode(
      url.searchParams.get("executionCountryCode") ?? ""
    );
    const currencyCode = normalizeKlyxCurrencyCode(
      url.searchParams.get("currency") ?? ""
    );
    const serviceSlug =
      url.searchParams.get("serviceSlug")?.trim() || "*";

    const subtotalMinor = decimalToKlyxMinorUnits(
      amountText,
      currencyCode
    );

    if (subtotalMinor < 0) {
      return NextResponse.json(
        { error: "Montant invalide." },
        { status: 400 }
      );
    }

    const policy = await resolveKlyxMarketPaymentPolicy({
      payerCountryCode,
      executionCountryCode,
      serviceSlug,
      currencyCode,
    });

    if (
      !policy.rule ||
      !policy.currencyCapability ||
      !policy.assessment.allowed
    ) {
      return NextResponse.json(
        {
          error:
            "Aucune politique économique KLYX active ne couvre cette combinaison pays/devise/service.",
          code: "KLYX_PUBLIC_ECONOMICS_POLICY_NOT_READY",
          blockers: policy.assessment.blockers,
        },
        { status: 409 }
      );
    }

    const economics = calculateKlyxMarketEconomics({
      subtotalMinor,
      commissionBps: policy.rule.commissionBps,
      taxMode: policy.rule.taxMode,
      taxRateBps: policy.rule.taxRateBps,
      taxInclusive: policy.rule.taxInclusive,
      taxLiability: policy.rule.taxLiability,
    });

    return NextResponse.json({
      payerCountryCode,
      executionCountryCode,
      currency: currencyCode,
      serviceSlug,
      marketPaymentRuleId: policy.rule.id,
      commissionBps: policy.rule.commissionBps,
      commissionPercent: policy.rule.commissionBps / 100,
      taxMode: policy.rule.taxMode,
      taxRateBps: policy.rule.taxRateBps,
      taxInclusive: policy.rule.taxInclusive,
      taxLiability: policy.rule.taxLiability,
      subtotalMinor: economics.subtotalMinor,
      taxMinor: economics.taxMinor,
      totalMinor: economics.totalMinor,
      commissionMinor: economics.commissionMinor,
      platformFeeMinor: economics.platformFeeMinor,
      providerAmountMinor: economics.providerAmountMinor,
      subtotal: klyxMinorUnitsToDecimalString(
        economics.subtotalMinor,
        currencyCode
      ),
      tax: klyxMinorUnitsToDecimalString(
        economics.taxMinor,
        currencyCode
      ),
      total: klyxMinorUnitsToDecimalString(
        economics.totalMinor,
        currencyCode
      ),
      commission: klyxMinorUnitsToDecimalString(
        economics.commissionMinor,
        currencyCode
      ),
      providerAmount: klyxMinorUnitsToDecimalString(
        economics.providerAmountMinor,
        currencyCode
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Paramètres économiques invalides.";

    return NextResponse.json(
      {
        error: message,
        code: "KLYX_PUBLIC_ECONOMICS_INVALID_REQUEST",
      },
      { status: 400 }
    );
  }
}
