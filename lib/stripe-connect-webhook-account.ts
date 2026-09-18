import type Stripe from "stripe";

import {
  markStripeConnectIdentityReview,
  updateCanonicalStripeAccountStatus,
} from "@/lib/stripe-connect-account";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function syncCanonicalConnectedAccountFromStripe(
  stripeAccount: Stripe.Account
): Promise<"updated" | "review_required" | "unmapped"> {
  const { data: canonical, error: canonicalError } = await supabaseAdmin
    .from("accounts")
    .select("id, stripe_connect_state")
    .eq("stripe_account_id", stripeAccount.id)
    .maybeSingle();

  if (canonicalError) throw new Error(canonicalError.message);

  if (canonical) {
    if (canonical.stripe_connect_state === "review_required") {
      await markStripeConnectIdentityReview({
        accountId: canonical.id,
        reason: "webhook_received_for_review_required_identity",
        candidateStripeAccountIds: [stripeAccount.id],
      });
      return "review_required";
    }

    await updateCanonicalStripeAccountStatus({
      accountId: canonical.id,
      stripeAccount,
    });
    return "updated";
  }

  // A webhook may arrive for an old profile-owned acct_* during the migration.
  // Never adopt it automatically. Mark the owning canonical account for review.
  const { data: legacyProfiles, error: legacyError } = await supabaseAdmin
    .from("profiles")
    .select("account_id")
    .eq("stripe_account_id", stripeAccount.id)
    .not("account_id", "is", null);

  if (legacyError) throw new Error(legacyError.message);

  const accountIds = Array.from(
    new Set(
      (legacyProfiles ?? [])
        .map((profile) => profile.account_id?.trim() ?? "")
        .filter(Boolean)
    )
  );

  if (accountIds.length === 1) {
    await markStripeConnectIdentityReview({
      accountId: accountIds[0],
      reason: "webhook_received_for_legacy_unlinked_stripe_identity",
      candidateStripeAccountIds: [stripeAccount.id],
    });
    return "review_required";
  }

  return "unmapped";
}
