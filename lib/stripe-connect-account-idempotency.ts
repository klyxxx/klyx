type StripeRuntimeMode = "test" | "live";

// Rotate this deterministic revision only when KLYX must intentionally escape
// a previously cached Stripe account-creation result. Identity is account-level:
// switching legacy profiles must never create a second Connected Account.
const STRIPE_CONNECT_ACCOUNT_CREATE_KEY_REVISION = "v4";

function normalizeToken(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96);
}

export function stripeConnectAccountCreateIdempotencyKey(params: {
  accountId: string;
  runtimeMode: StripeRuntimeMode;
}): string {
  const accountId = normalizeToken(params.accountId);

  return `klyx-connect-account-${params.runtimeMode}-${accountId}-initial-${STRIPE_CONNECT_ACCOUNT_CREATE_KEY_REVISION}`;
}
