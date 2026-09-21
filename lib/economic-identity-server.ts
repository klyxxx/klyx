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

type StripeV2AccountProjection = {
  id: string;
  livemode?: boolean | null;
  applied_configurations?: readonly string[] | null;
  configuration?: unknown;
  identity?: unknown;
  requirements?: unknown;
  future_requirements?: unknown;
};

type NormalizedEconomicStripeProjection = {
  stripeAccountId: string;
  countryCode: string | null;
  businessType: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  requirementErrors: Array<Record<string, unknown>>;
  disabledReason: string | null;
  capabilities: Record<string, unknown>;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
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

function capabilityStatus(value: unknown): string | null {
  if (typeof value === "string") return value.trim().toLowerCase() || null;
  const status = asRecord(value).status;
  return typeof status === "string"
    ? status.trim().toLowerCase() || null
    : null;
}

function normalizeV2RequirementDescriptions(value: unknown): string[] {
  const entries = asArray(asRecord(value).entries);
  return Array.from(
    new Set(
      entries.map((entry, index) => {
        const record = asRecord(entry);
        return (
          stringValue(record.description) ??
          stringValue(record.id) ??
          stringValue(record.type) ??
          `stripe_requirement_${index + 1}`
        );
      })
    )
  ).sort();
}

function normalizeV2Account(
  account: StripeV2AccountProjection
): NormalizedEconomicStripeProjection {
  const configuration = asRecord(account.configuration);
  const recipient = asRecord(configuration.recipient);
  const recipientCapabilities = asRecord(recipient.capabilities);
  const recipientBalance = asRecord(recipientCapabilities.stripe_balance);
  const transferStatus = capabilityStatus(
    recipientBalance.stripe_transfers
  );
  const payoutStatus = capabilityStatus(recipientBalance.payouts);

  const merchant = asRecord(configuration.merchant);
  const merchantCapabilities = asRecord(merchant.capabilities);
  const cardPaymentsStatus = capabilityStatus(
    merchantCapabilities.card_payments
  );

  const identity = asRecord(account.identity);
  const currentlyDue = normalizeV2RequirementDescriptions(
    account.requirements
  );
  const eventuallyDue = normalizeV2RequirementDescriptions(
    account.future_requirements
  );

  const recipientApplied =
    account.applied_configurations?.includes("recipient") === true &&
    recipient.applied === true;
  const transferActive = transferStatus === "active";
  const payoutsActive = payoutStatus === "active";

  let disabledReason: string | null = null;
  if (!recipientApplied) {
    disabledReason = "accounts_v2_recipient_not_applied";
  } else if (!transferActive) {
    disabledReason =
      `accounts_v2_stripe_transfers_${transferStatus ?? "missing"}`;
  } else if (!payoutsActive) {
    disabledReason =
      `accounts_v2_payouts_${payoutStatus ?? "missing"}`;
  }

  return {
    stripeAccountId: account.id,
    countryCode: stringValue(identity.country)?.toUpperCase() ?? null,
    businessType: stringValue(identity.entity_type),
    // Accounts v2 does not expose the v1 details_submitted boolean. KLYX
    // normalizes "submitted" as a recipient configuration that is applied,
    // has active transfer + payout capabilities, and has no current
    // requirements. This is a projection fact, never authorization by itself.
    detailsSubmitted:
      recipientApplied &&
      transferActive &&
      payoutsActive &&
      currentlyDue.length === 0,
    chargesEnabled: cardPaymentsStatus === "active",
    payoutsEnabled: payoutsActive,
    currentlyDue,
    eventuallyDue,
    pastDue: [],
    pendingVerification: [],
    requirementErrors: [],
    disabledReason,
    capabilities: {
      stripe_balance: {
        stripe_transfers: { status: transferStatus },
        payouts: { status: payoutStatus },
      },
      merchant: {
        card_payments: { status: cardPaymentsStatus },
      },
      source: "accounts_v2",
    },
  };
}

function normalizeV1Account(
  account: Stripe.Account
): NormalizedEconomicStripeProjection {
  const requirements =
    (account.requirements as StripeRequirementsProjection | null) ?? null;

  return {
    stripeAccountId: account.id,
    countryCode: account.country?.trim().toUpperCase() ?? null,
    businessType: account.business_type ?? null,
    detailsSubmitted: Boolean(account.details_submitted),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    currentlyDue: normalizeStringArray(requirements?.currently_due),
    eventuallyDue: normalizeStringArray(requirements?.eventually_due),
    pastDue: normalizeStringArray(requirements?.past_due),
    pendingVerification: normalizeStringArray(
      requirements?.pending_verification
    ),
    requirementErrors: requirements?.errors ?? [],
    disabledReason: requirements?.disabled_reason ?? null,
    capabilities: normalizeCapabilities(account.capabilities),
  };
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

async function assertCanonicalStripeIdentity(input: {
  accountId: string;
  stripeAccountId: string;
  correlationId?: string | null;
}): Promise<void> {
  const canonical = await loadCanonicalStripeIdentity(input.accountId);

  if (
    !canonical ||
    canonical.identity_state !== "linked" ||
    canonical.stripe_account_id !== input.stripeAccountId
  ) {
    await markEconomicIdentityHumanReview({
      accountId: input.accountId,
      reasonCode: "stripe_identity_not_canonical",
      correlationId: input.correlationId,
    });

    throw new EconomicIdentityReviewRequiredError();
  }
}

async function persistEconomicStripeProjection(input: {
  accountId: string;
  projection: NormalizedEconomicStripeProjection;
  correlationId?: string | null;
}): Promise<void> {
  await assertCanonicalStripeIdentity({
    accountId: input.accountId,
    stripeAccountId: input.projection.stripeAccountId,
    correlationId: input.correlationId,
  });

  const { error } = await supabaseAdmin.rpc(
    "klyx_upsert_economic_stripe_projection",
    {
      p_account_id: input.accountId,
      p_stripe_account_id: input.projection.stripeAccountId,
      p_country_code: input.projection.countryCode,
      p_business_type: input.projection.businessType,
      p_details_submitted: input.projection.detailsSubmitted,
      p_charges_enabled: input.projection.chargesEnabled,
      p_payouts_enabled: input.projection.payoutsEnabled,
      p_currently_due: input.projection.currentlyDue,
      p_eventually_due: input.projection.eventuallyDue,
      p_past_due: input.projection.pastDue,
      p_pending_verification: input.projection.pendingVerification,
      p_requirement_errors: input.projection.requirementErrors,
      p_disabled_reason: input.projection.disabledReason,
      p_capabilities: input.projection.capabilities,
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

/**
 * Persist a Stripe Accounts v1 account only as an economic provider projection.
 * The canonical account/Stripe binding is re-checked before every write.
 */
export async function syncEconomicStripeProjectionFromStripe(input: {
  accountId: string;
  stripeAccount: Stripe.Account;
  correlationId?: string | null;
}): Promise<void> {
  await persistEconomicStripeProjection({
    accountId: input.accountId,
    projection: normalizeV1Account(input.stripeAccount),
    correlationId: input.correlationId,
  });
}

/**
 * Persist Accounts v2 recipient truth without forcing it through v1 booleans.
 * Payout capability is distinct from stripe_transfers and both must be active
 * for KLYX's settlement projection to be considered green.
 */
export async function syncEconomicStripeProjectionFromStripeV2(input: {
  accountId: string;
  stripeAccount: StripeV2AccountProjection;
  correlationId?: string | null;
}): Promise<void> {
  await persistEconomicStripeProjection({
    accountId: input.accountId,
    projection: normalizeV2Account(input.stripeAccount),
    correlationId: input.correlationId,
  });
}

/**
 * Refresh the economic Stripe projection from the remote provider immediately
 * before a sensitive settlement decision. Accounts v2 is authoritative when it
 * can resolve the account; v1 is a compatibility fallback for historical
 * connected accounts that are not represented by Accounts v2.
 */
export async function syncEconomicStripeProjectionFromRemoteStripe(input: {
  stripe: Stripe;
  accountId: string;
  stripeAccountId: string;
  correlationId?: string | null;
}): Promise<"accounts_v2" | "accounts_v1"> {
  await assertCanonicalStripeIdentity({
    accountId: input.accountId,
    stripeAccountId: input.stripeAccountId,
    correlationId: input.correlationId,
  });

  let v2Account: StripeV2AccountProjection | null = null;
  let v2ReadError: unknown = null;

  try {
    v2Account = await input.stripe.v2.core.accounts.retrieve(
      input.stripeAccountId,
      {
        include: [
          "configuration.merchant",
          "configuration.recipient",
          "identity",
          "requirements",
        ],
      }
    );
  } catch (error) {
    v2ReadError = error;
  }

  if (v2Account) {
    await syncEconomicStripeProjectionFromStripeV2({
      accountId: input.accountId,
      stripeAccount: v2Account,
      correlationId: input.correlationId,
    });
    return "accounts_v2";
  }

  try {
    const account = await input.stripe.accounts.retrieve(
      input.stripeAccountId
    );

    await syncEconomicStripeProjectionFromStripe({
      accountId: input.accountId,
      stripeAccount: account,
      correlationId: input.correlationId,
    });
    return "accounts_v1";
  } catch {
    if (v2ReadError) throw v2ReadError;
    throw new Error("KLYX_ECONOMIC_STRIPE_REMOTE_ACCOUNT_UNAVAILABLE");
  }
}
