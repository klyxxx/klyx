import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED =
  "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED";

export type CanonicalStripeConnectState =
  | "unlinked"
  | "linked"
  | "review_required";

export type CanonicalStripeConnect = {
  accountId: string;
  stripeAccountId: string | null;
  state: CanonicalStripeConnectState;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  statusUpdatedAt: string | null;
};

export type ProviderStripeDestination = {
  profileId: string;
  accountId: string;
  countryCode: string | null;
  legacyStripeAccountId: string | null;
  connect: CanonicalStripeConnect;
};

type AccountStripeRow = {
  id: string;
  stripe_account_id: string | null;
  stripe_connect_state: CanonicalStripeConnectState;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_status_updated_at: string | null;
};

type ProviderProfileStripeRow = {
  id: string;
  account_id: string | null;
  country_code: string | null;
  stripe_account_id: string | null;
};

type HistoricalStripeRow = {
  id: string;
  stripe_account_id: string | null;
};

export class StripeConnectIdentityReviewRequiredError extends Error {
  readonly code = STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED;

  constructor(message = "L'identité Stripe Connect de ce compte KLYX nécessite une revue manuelle.") {
    super(message);
    this.name = "StripeConnectIdentityReviewRequiredError";
  }
}

export function isStripeConnectIdentityReviewRequired(
  error: unknown
): error is StripeConnectIdentityReviewRequiredError {
  return (
    error instanceof StripeConnectIdentityReviewRequiredError ||
    (error instanceof Error &&
      error.message.includes(STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED))
  );
}

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

  // Historical Connect identity must be promoted/reviewed by the migration or
  // an operator. Runtime code must never create a replacement automatically.
  if (history.length > 0) {
    return "review_required";
  }

  return "create";
}

export function resolveCanonicalAccountCountry(
  countryCodes: Array<string | null | undefined>
): string {
  const countries = Array.from(
    new Set(
      countryCodes
        .map((value) => value?.trim().toUpperCase() ?? "")
        .filter(Boolean)
    )
  );

  const country = countries[0];

  if (countries.length !== 1 || !country) {
    throw new StripeConnectIdentityReviewRequiredError(
      countries.length === 0
        ? "Le pays du compte KLYX doit être défini avant l'activation des paiements."
        : "Plusieurs pays sont associés à ce compte KLYX. Une revue est requise avant l'activation des paiements."
    );
  }

  return country;
}

function mapAccountStripeRow(row: AccountStripeRow): CanonicalStripeConnect {
  return {
    accountId: row.id,
    stripeAccountId: row.stripe_account_id,
    state: row.stripe_connect_state,
    onboardingComplete: row.stripe_onboarding_complete,
    chargesEnabled: row.stripe_charges_enabled,
    payoutsEnabled: row.stripe_payouts_enabled,
    statusUpdatedAt: row.stripe_status_updated_at,
  };
}

export async function getCanonicalStripeConnect(
  accountId: string
): Promise<CanonicalStripeConnect> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select(
      "id, stripe_account_id, stripe_connect_state, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, stripe_status_updated_at"
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Compte KLYX canonique introuvable.");

  return mapAccountStripeRow(data as AccountStripeRow);
}

export async function getHistoricalStripeAccountIds(
  accountId: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("stripe_account_id")
    .eq("account_id", accountId)
    .not("stripe_account_id", "is", null);

  if (error) throw new Error(error.message);

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ stripe_account_id: string | null }>)
        .map((row) => row.stripe_account_id?.trim() ?? "")
        .filter(Boolean)
    )
  );
}

export async function markStripeConnectIdentityReview(input: {
  accountId: string;
  reason: string;
  candidateStripeAccountIds?: string[];
}): Promise<void> {
  const { error: accountError } = await supabaseAdmin
    .from("accounts")
    .update({ stripe_connect_state: "review_required" })
    .eq("id", input.accountId);

  if (accountError) throw new Error(accountError.message);

  const { data: sourceProfiles, error: sourceError } = await supabaseAdmin
    .from("profiles")
    .select("id, stripe_account_id")
    .eq("account_id", input.accountId)
    .not("stripe_account_id", "is", null);

  if (sourceError) throw new Error(sourceError.message);

  const historical = (sourceProfiles ?? []) as HistoricalStripeRow[];
  const candidateStripeAccountIds = Array.from(
    new Set([
      ...historical
        .map((profile) => profile.stripe_account_id?.trim() ?? "")
        .filter(Boolean),
      ...(input.candidateStripeAccountIds ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ])
  );
  const sourceProfileIds = historical.map((profile) => profile.id);

  const { data: pendingReview, error: pendingError } = await supabaseAdmin
    .from("stripe_connect_identity_reviews")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingError) throw new Error(pendingError.message);

  if (pendingReview) {
    const { error } = await supabaseAdmin
      .from("stripe_connect_identity_reviews")
      .update({
        reason: input.reason,
        candidate_stripe_account_ids: candidateStripeAccountIds,
        source_profile_ids: sourceProfileIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingReview.id);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabaseAdmin
    .from("stripe_connect_identity_reviews")
    .insert({
      account_id: input.accountId,
      reason: input.reason,
      candidate_stripe_account_ids: candidateStripeAccountIds,
      source_profile_ids: sourceProfileIds,
    });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function getStripeConnectCreationDecision(
  accountId: string
): Promise<{
  decision: "reuse" | "create" | "review_required";
  connect: CanonicalStripeConnect;
  historicalStripeAccountIds: string[];
}> {
  const [connect, historicalStripeAccountIds] = await Promise.all([
    getCanonicalStripeConnect(accountId),
    getHistoricalStripeAccountIds(accountId),
  ]);

  return {
    decision: assessStripeConnectCreation({
      state: connect.state,
      canonicalStripeAccountId: connect.stripeAccountId,
      historicalStripeAccountIds,
    }),
    connect,
    historicalStripeAccountIds,
  };
}

export async function bindCanonicalStripeAccount(
  accountId: string,
  stripeAccountId: string
): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_bind_account_stripe_connect",
    {
      p_account_id: accountId,
      p_stripe_account_id: stripeAccountId,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data === "review_required") {
    throw new StripeConnectIdentityReviewRequiredError();
  }

  if (data !== "linked") {
    throw new Error("Résultat de liaison Stripe Connect inattendu.");
  }
}

export async function updateCanonicalStripeAccountStatus(input: {
  accountId: string;
  stripeAccount: Stripe.Account;
}): Promise<void> {
  const status = {
    stripe_onboarding_complete: input.stripeAccount.details_submitted,
    stripe_charges_enabled: input.stripeAccount.charges_enabled,
    stripe_payouts_enabled: input.stripeAccount.payouts_enabled,
    stripe_status_updated_at: new Date().toISOString(),
  };

  const { data: updatedAccount, error: accountError } = await supabaseAdmin
    .from("accounts")
    .update(status)
    .eq("id", input.accountId)
    .eq("stripe_account_id", input.stripeAccount.id)
    .eq("stripe_connect_state", "linked")
    .select("id")
    .maybeSingle();

  if (accountError) throw new Error(accountError.message);
  if (!updatedAccount) {
    await markStripeConnectIdentityReview({
      accountId: input.accountId,
      reason: "stripe_status_identity_mismatch",
      candidateStripeAccountIds: [input.stripeAccount.id],
    });
    throw new StripeConnectIdentityReviewRequiredError();
  }

  // Compatibility mirror only. The canonical Stripe id itself is never copied
  // to sibling profiles; profile ids remain historical records during rollout.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_onboarding_complete: status.stripe_onboarding_complete,
      stripe_charges_enabled: status.stripe_charges_enabled,
      stripe_payouts_enabled: status.stripe_payouts_enabled,
    })
    .eq("account_id", input.accountId);

  if (profileError) throw new Error(profileError.message);
}

export async function getProviderStripeDestination(
  profileId: string
): Promise<ProviderStripeDestination> {
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, account_id, country_code, stripe_account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profileData) throw new Error("Prestataire introuvable.");

  const profile = profileData as ProviderProfileStripeRow;

  if (!profile.account_id) {
    throw new StripeConnectIdentityReviewRequiredError(
      "Le prestataire n'est pas rattaché à un compte KLYX canonique."
    );
  }

  const connect = await getCanonicalStripeConnect(profile.account_id);

  if (connect.state === "review_required") {
    throw new StripeConnectIdentityReviewRequiredError();
  }

  if (
    profile.stripe_account_id &&
    connect.stripeAccountId &&
    profile.stripe_account_id !== connect.stripeAccountId
  ) {
    await markStripeConnectIdentityReview({
      accountId: profile.account_id,
      reason: "provider_profile_canonical_stripe_mismatch",
      candidateStripeAccountIds: [
        profile.stripe_account_id,
        connect.stripeAccountId,
      ],
    });
    throw new StripeConnectIdentityReviewRequiredError();
  }

  if (!connect.stripeAccountId && profile.stripe_account_id) {
    await markStripeConnectIdentityReview({
      accountId: profile.account_id,
      reason: "legacy_stripe_identity_not_promoted",
      candidateStripeAccountIds: [profile.stripe_account_id],
    });
    throw new StripeConnectIdentityReviewRequiredError();
  }

  return {
    profileId: profile.id,
    accountId: profile.account_id,
    countryCode: profile.country_code,
    legacyStripeAccountId: profile.stripe_account_id,
    connect,
  };
}
