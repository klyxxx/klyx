type StripeRuntimeMode = "test" | "live";

// Rotate this deterministic revision only when KLYX must intentionally escape
// a previously cached Stripe account-creation result. Stripe can replay the
// original response for an idempotency key, including a 400 produced before
// the platform was activated. Keeping the revision deterministic preserves
// duplicate-account protection while allowing a fresh request after that
// platform state changes.
//
// v3 is intentionally rotated after the live Connect platform profile was
// completed. The previous v2 replacement key is already bound by Stripe to the
// earlier platform-profile-incomplete 400 and would otherwise replay that
// stale response even after Stripe accepted the questionnaire.
const STRIPE_CONNECT_ACCOUNT_CREATE_KEY_REVISION = "v3";

function normalizeToken(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96);
}

export function stripeConnectAccountCreateIdempotencyKey(params: {
  profileId: string;
  runtimeMode: StripeRuntimeMode;
  staleAccountId?: string | null;
}): string {
  const profileId = normalizeToken(params.profileId);
  const staleAccountId = normalizeToken(params.staleAccountId ?? "");
  const purpose = staleAccountId ? `replace-${staleAccountId}` : "initial";

  return `klyx-connect-account-${params.runtimeMode}-${profileId}-${purpose}-${STRIPE_CONNECT_ACCOUNT_CREATE_KEY_REVISION}`;
}
