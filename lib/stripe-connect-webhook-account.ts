import type Stripe from "stripe";

import {
  markStripeConnectIdentityReview,
  updateCanonicalStripeAccountStatus,
} from "@/lib/stripe-connect-account";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CanonicalIdentityRow = {
  account_id: string;
  identity_state: "linked" | "conflict";
};

export async function syncCanonicalConnectedAccountFromStripe(
  stripeAccount: Stripe.Account
): Promise<"updated" | "review_required" | "unmapped"> {
  const { data: canonical, error: canonicalError } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select("account_id, identity_state")
    .eq("stripe_account_id", stripeAccount.id)
    .maybeSingle();

  if (canonicalError) throw new Error(canonicalError.message);

  if (canonical) {
    const identity = canonical as CanonicalIdentityRow;

    if (identity.identity_state === "conflict") {
      await markStripeConnectIdentityReview({
        accountId: identity.account_id,
        reason: "webhook_received_for_conflicted_identity",
        candidateStripeAccountIds: [stripeAccount.id],
      });
      return "review_required";
    }

    await updateCanonicalStripeAccountStatus({
      accountId: identity.account_id,
      stripeAccount,
    });
    return "updated";
  }

  // Historical profile ids are compatibility evidence only. A webhook for one
  // of them must never promote it over #799 canonical account identity.
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
