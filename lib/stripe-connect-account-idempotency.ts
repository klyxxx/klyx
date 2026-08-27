type StripeRuntimeMode = "test" | "live";

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

  return `klyx-connect-account-${params.runtimeMode}-${profileId}-${purpose}`;
}
