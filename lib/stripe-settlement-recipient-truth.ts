import "server-only";

import type Stripe from "stripe";

export type StripeSettlementRecipientTruth = {
  stripeAccountId: string;
  livemode: boolean;
  transferCapabilityActive: boolean;
  source: "accounts_v2" | "accounts_v1";
};

export async function readStripeSettlementRecipientTruth(
  stripe: Stripe,
  stripeAccountId: string
): Promise<StripeSettlementRecipientTruth> {
  try {
    const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
      include: ["configuration.recipient", "identity", "requirements"],
    });

    return {
      stripeAccountId: account.id,
      livemode: Boolean(account.livemode),
      transferCapabilityActive: Boolean(
        account.applied_configurations?.includes("recipient") === true &&
          account.configuration?.recipient?.applied === true &&
          account.configuration?.recipient?.capabilities?.stripe_balance
            ?.stripe_transfers?.status === "active"
      ),
      source: "accounts_v2",
    };
  } catch (v2Error) {
    try {
      const account = await stripe.accounts.retrieve(stripeAccountId);
      const transferStatus = account.capabilities?.transfers;

      return {
        stripeAccountId: account.id,
        livemode: Boolean(account.livemode),
        transferCapabilityActive:
          transferStatus === "active" && account.payouts_enabled === true,
        source: "accounts_v1",
      };
    } catch {
      throw v2Error;
    }
  }
}
