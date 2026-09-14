export type CanonicalStripeConnectState =
  | "unlinked"
  | "linked"
  | "review_required";

export function assessStripeConnectCreation(input: {
  state: CanonicalStripeConnectState;
  canonicalStripeAccountId: string | null;
  historicalStripeAccountIds: string[];
}): "reuse" | "create" | "review_required" {
  const history = Array.from(
    new Set(
      input.historicalStripeAccountIds
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (input.state === "review_required") {
    return "review_required";
  }

  if (input.canonicalStripeAccountId) {
    if (
      history.some(
        (stripeAccountId) =>
          stripeAccountId !== input.canonicalStripeAccountId
      )
    ) {
      return "review_required";
    }

    return "reuse";
  }

  // Historical identity always wins over account creation. Runtime code must
  // never create a replacement for an acct_* already present in KLYX history.
  if (history.length > 0) {
    return "review_required";
  }

  return "create";
}
