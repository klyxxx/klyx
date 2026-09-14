type StripeRuntimeMode = "test" | "live";

// A canonical KLYX account may own at most one Stripe Connected Account per
// runtime mode. Never rotate this key to recover a missing/stale acct_* at
// runtime: identity conflicts must be reviewed instead of creating a silent
// replacement.
const STRIPE_CONNECT_ACCOUNT_CREATE_KEY_REVISION = "account-v1";

function normalizeToken(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96);
}

export function stripeConnectAccountCreateIdempotencyKey(params: {
  accountId: string;
  runtimeMode: StripeRuntimeMode;
}): string {
  const accountId = normalizeToken(params.accountId);

  return `klyx-connect-account-${params.runtimeMode}-${accountId}-${STRIPE_CONNECT_ACCOUNT_CREATE_KEY_REVISION}`;
}
