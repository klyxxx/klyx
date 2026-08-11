export const KLYX_DEFAULT_COMMISSION_PERCENT = 15;

export type KlyxEconomics = {
  grossAmountCents: number;
  commissionPercent: number;
  platformFeeCents: number;
  providerAmountCents: number;
};

export function getKlyxCommissionPercent(): number {
  const raw =
    process.env.KLYX_COMMISSION_PERCENT?.trim() ||
    String(KLYX_DEFAULT_COMMISSION_PERCENT);

  const value = Number(raw);

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(
      "KLYX_COMMISSION_PERCENT doit être compris entre 0 et 100."
    );
  }

  return value;
}

export function calculateKlyxEconomics(
  grossAmountCents: number,
  commissionPercent = getKlyxCommissionPercent()
): KlyxEconomics {
  if (
    !Number.isInteger(grossAmountCents) ||
    grossAmountCents < 0
  ) {
    throw new Error(
      "Le montant brut KLYX doit être un entier positif en centimes."
    );
  }

  if (
    !Number.isFinite(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    throw new Error(
      "La commission KLYX doit être comprise entre 0 et 100."
    );
  }

  const platformFeeCents = Math.round(
    grossAmountCents * (commissionPercent / 100)
  );

  return {
    grossAmountCents,
    commissionPercent,
    platformFeeCents,
    providerAmountCents:
      grossAmountCents - platformFeeCents,
  };
}

export function centsToEuros(
  cents: number
): number {
  return Math.round(cents) / 100;
}
