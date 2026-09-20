import "server-only";

import type Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const ECONOMIC_IDENTITY_REVIEW_REQUIRED =
  "KLYX_ECONOMIC_IDENTITY_REVIEW_REQUIRED";

type CanonicalStripeIdentityRow = {
  identity_state: "linked" | "conflict";
  stripe_account_id: string | null;
};

type StripeRequirementsProjection = {
  currently_due?: string[] | null;
  eventually_due?: string[] | null;
  past_due?: string[] | null;
  pending_verification?: string[] | null;
  errors?: Array<Record<string, unknown>> | null;
  disabled_reason?: string | null;
};

export class EconomicIdentityReviewRequiredError extends Error {
  readonly code = ECONOMIC_IDENTITY_REVIEW_REQUIRED;

  constructor(
    message = "L'identité économique KLYX nécessite une revue humaine."
  ) {
    super(message);
    this.name = "EconomicIdentityReviewRequiredError";
  }
}

function normalizeStringArray(
  values: string[] | null | undefined
): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).sort();
}

function normalizeCapabilities(
  capabilities: Stripe.Account["capabilities"]
): Record<string, unknown> {
  if (!capabilities || typeof capabilities !== "object") return {};
  return { ...capabilities };
}

async function markEconomicIdentityHumanReview(input: {
  accountId: string;
  reasonCode: string;
  correlationId?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc(
    "klyx_mark_economic_identity_human_review",
    {
      p_account_id: input.accountId,
      p_reason_code: input.reasonCode,
      p_source: "trusted_provider",
      p_correlation_id: input.correlationId ?? null,
    }
  );

  if (error) throw new Error(error.message);
}

async function loadCanonicalStripeIdentity(
  accountId: string
): Promise<CanonicalStripeIdentityRow | null> {
  const { data, error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select("identity_state, stripe_account_id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data as CanonicalStripeIdentityRow | null) ?? null;
}

/**
 * Persist Stripe account status only as an economic provider projection.
 *
 * This function re-checks the canonical account-first Stripe identity before
 * writing anything. It never grants a KLYX capability, qualification,
 * activity-eligibility decision, or financial permission.
 */
export async function syncEconomicStripeProjectionFromStripe(input: {
  accountId: string;
  stripeAccount: Stripe.Account;
  correlationId?: string | null;
}): Promise<void> {
  const canonical = await loadCanonicalStripeIdentity(input.accountId);

  if (
    !canonical ||
    canonical.identity_state !== "linked" ||
    canonical.stripe_account_id !== input.stripeAccount.id
  ) {
    await markEconomicIdentityHumanReview({
      accountId: input.accountId,
      reasonCode: "stripe_identity_not_canonical",
      correlationId: input.correlationId,
    });

    throw new EconomicIdentityReviewRequiredError();
  }

  const requirements =
    (input.stripeAccount.requirements as StripeRequirementsProjection | null) ??
    null;

  const { error } = await supabaseAdmin.rpc(
    "klyx_upsert_economic_stripe_projection",
    {
      p_account_id: input.accountId,
      p_stripe_account_id: input.stripeAccount.id,
      p_country_code: input.stripeAccount.country?.trim().toUpperCase() ?? null,
      p_business_type: input.stripeAccount.business_type ?? null,
      p_details_submitted: Boolean(input.stripeAccount.details_submitted),
      p_charges_enabled: Boolean(input.stripeAccount.charges_enabled),
      p_payouts_enabled: Boolean(input.stripeAccount.payouts_enabled),
      p_currently_due: normalizeStringArray(requirements?.currently_due),
      p_eventually_due: normalizeStringArray(requirements?.eventually_due),
      p_past_due: normalizeStringArray(requirements?.past_due),
      p_pending_verification: normalizeStringArray(
        requirements?.pending_verification
      ),
      p_requirement_errors: requirements?.errors ?? [],
      p_disabled_reason: requirements?.disabled_reason ?? null,
      p_capabilities: normalizeCapabilities(input.stripeAccount.capabilities),
      p_provider_observed_at: new Date().toISOString(),
      p_correlation_id: input.correlationId ?? null,
    }
  );

  if (error) {
    if (
      error.message.includes(
        "KLYX_ECONOMIC_STRIPE_IDENTITY_REVIEW_REQUIRED"
      )
    ) {
      await markEconomicIdentityHumanReview({
        accountId: input.accountId,
        reasonCode: "stripe_identity_changed_during_projection_sync",
        correlationId: input.correlationId,
      });

      throw new EconomicIdentityReviewRequiredError();
    }

    throw new Error(error.message);
  }
}
