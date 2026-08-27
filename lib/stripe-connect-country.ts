export const STRIPE_ACCOUNT_COUNTRY_MISMATCH =
  "STRIPE_ACCOUNT_COUNTRY_MISMATCH" as const;

function normalizeCountryCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

export type StripeConnectCountryAssessment = {
  klyxCountryCode: string;
  stripeCountryCode: string;
  matches: boolean;
  blocker: typeof STRIPE_ACCOUNT_COUNTRY_MISMATCH | null;
};

export function assessStripeConnectCountry(params: {
  klyxCountryCode: string | null | undefined;
  stripeCountryCode: string | null | undefined;
}): StripeConnectCountryAssessment {
  const klyxCountryCode = normalizeCountryCode(params.klyxCountryCode);
  const stripeCountryCode = normalizeCountryCode(params.stripeCountryCode);
  const matches =
    /^[A-Z]{2}$/.test(klyxCountryCode) &&
    /^[A-Z]{2}$/.test(stripeCountryCode) &&
    klyxCountryCode === stripeCountryCode;

  return {
    klyxCountryCode,
    stripeCountryCode,
    matches,
    blocker: matches ? null : STRIPE_ACCOUNT_COUNTRY_MISMATCH,
  };
}
