import { NextResponse } from "next/server";
import {
  calculateKlyxEconomics,
  centsToEuros,
  getKlyxCommissionPercent,
} from "@/lib/klyx-economics";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const amount = Number(
    url.searchParams.get("amount") || "100"
  );

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1000000
  ) {
    return NextResponse.json(
      { error: "Montant invalide." },
      { status: 400 }
    );
  }

  const grossAmountCents = Math.round(
    amount * 100
  );

  const result = calculateKlyxEconomics(
    grossAmountCents,
    getKlyxCommissionPercent()
  );

  return NextResponse.json({
    commissionPercent:
      result.commissionPercent,
    grossAmount: centsToEuros(
      result.grossAmountCents
    ),
    platformFee: centsToEuros(
      result.platformFeeCents
    ),
    providerAmount: centsToEuros(
      result.providerAmountCents
    ),
    currency: "EUR",
  });
}
