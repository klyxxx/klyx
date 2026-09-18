import "server-only";

import type Stripe from "stripe";

import {
  getAccountStripeConnectIdentity,
  markAccountStripeConnectIdentityForReview,
  persistAccountStripeConnectIdentity,
  STRIPE_CONNECT_IDENTITY_CONFLICT,
  STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED as CANONICAL_REVIEW_REQUIRED,
} from "@/lib/stripe-connect-account-identity";
import {
  assessStripeConnectCreation,
  type CanonicalStripeConnectState,
} from "@/lib/stripe-connect-account-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

export { assessStripeConnectCreation };
export type { CanonicalStripeConnectState };

export const STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED =
  "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED";

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

type ProviderProfileStripeRow = {
  id: string;
  account_id: string | null;
  country_code: string | null;
  stripe_account_id: string | null;
};

type ReadinessRow = {
  id: string;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
};

type HistoricalStripeRow = {
  id: string;
  stripe_account_id: string | null;
};

export class StripeConnectIdentityReviewRequiredError extends Error {
  readonly code = STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED;

  constructor(
    message = "L'identité Stripe Connect de ce compte KLYX nécessite une revue manuelle."
  ) {
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
      (error.message.includes(STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED) ||
        error.message.includes(CANONICAL_REVIEW_REQUIRED) ||
        error.message.includes(STRIPE_CONNECT_IDENTITY_CONFLICT)))
  );
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

async function readinessForCanonicalIdentity(
  accountId: string,
  sourceProfileIds: string[]
): Promise<Pick<
  CanonicalStripeConnect,
  "onboardingComplete" | "chargesEnabled" | "payoutsEnabled" | "statusUpdatedAt"
>> {
  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
    )
    .eq("account_id", accountId);

  if (sourceProfileIds.length > 0) {
    query = query.in("id", sourceProfileIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ReadinessRow[];
  const allReady = (key: keyof ReadinessRow) =>
    rows.length > 0 && rows.every((row) => row[key] === true);

  return {
    onboardingComplete: allReady("stripe_onboarding_complete"),
    chargesEnabled: allReady("stripe_charges_enabled"),
    payoutsEnabled: allReady("stripe_payouts_enabled"),
    statusUpdatedAt: null,
  };
}

export async function getCanonicalStripeConnect(
  accountId: string
): Promise<CanonicalStripeConnect> {
  const identity = await getAccountStripeConnectIdentity(accountId);
  const readiness = await readinessForCanonicalIdentity(
    accountId,
    identity.sourceProfileIds
  );

  return {
    accountId,
    stripeAccountId:
      identity.state === "linked" ? identity.stripeAccountId : null,
    state:
      identity.state === "conflict"
        ? "review_required"
        : identity.state,
    ...readiness,
  };
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
  const [identity, historicalStripeAccountIds] = await Promise.all([
    getAccountStripeConnectIdentity(input.accountId),
    getHistoricalStripeAccountIds(input.accountId),
  ]);

  const stripeAccountIds = Array.from(
    new Set(
      [
        ...(identity.conflictingStripeAccountIds ?? []),
        identity.stripeAccountId,
        ...historicalStripeAccountIds,
        ...(input.candidateStripeAccountIds ?? []),
      ]
        .map((value) => value?.trim() ?? "")
        .filter(Boolean)
    )
  );

  if (stripeAccountIds.length === 0) {
    throw new StripeConnectIdentityReviewRequiredError();
  }

  await markAccountStripeConnectIdentityForReview({
    accountId: input.accountId,
    stripeAccountIds,
    sourceProfileIds: identity.sourceProfileIds,
  });
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
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new StripeConnectIdentityReviewRequiredError(
      "Aucun profil KLYX ne permet de rattacher l'identité Stripe canonique."
    );
  }

  try {
    await persistAccountStripeConnectIdentity({
      accountId,
      stripeAccountId,
      sourceProfileId: data.id,
    });
  } catch (error) {
    if (isStripeConnectIdentityReviewRequired(error)) {
      throw new StripeConnectIdentityReviewRequiredError();
    }
    throw error;
  }
}

export async function updateCanonicalStripeAccountStatus(input: {
  accountId: string;
  stripeAccount: Stripe.Account;
}): Promise<void> {
  const identity = await getAccountStripeConnectIdentity(input.accountId);

  if (
    identity.state !== "linked" ||
    identity.stripeAccountId !== input.stripeAccount.id
  ) {
    await markAccountStripeConnectIdentityForReview({
      accountId: input.accountId,
      stripeAccountIds: Array.from(
        new Set(
          [identity.stripeAccountId, input.stripeAccount.id]
            .map((value) => value?.trim() ?? "")
            .filter(Boolean)
        )
      ),
      sourceProfileIds: identity.sourceProfileIds,
    });
    throw new StripeConnectIdentityReviewRequiredError();
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_onboarding_complete: Boolean(input.stripeAccount.details_submitted),
      stripe_charges_enabled: Boolean(input.stripeAccount.charges_enabled),
      stripe_payouts_enabled: Boolean(input.stripeAccount.payouts_enabled),
    })
    .eq("account_id", input.accountId);

  if (error) throw new Error(error.message);
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

  const legacyStripeAccountId = profile.stripe_account_id?.trim() || null;

  if (
    legacyStripeAccountId &&
    connect.stripeAccountId &&
    legacyStripeAccountId !== connect.stripeAccountId
  ) {
    await markStripeConnectIdentityReview({
      accountId: profile.account_id,
      reason: "provider_profile_canonical_stripe_mismatch",
      candidateStripeAccountIds: [
        legacyStripeAccountId,
        connect.stripeAccountId,
      ],
    });
    throw new StripeConnectIdentityReviewRequiredError();
  }

  if (!connect.stripeAccountId && legacyStripeAccountId) {
    await markStripeConnectIdentityReview({
      accountId: profile.account_id,
      reason: "legacy_stripe_identity_not_canonicalized",
      candidateStripeAccountIds: [legacyStripeAccountId],
    });
    throw new StripeConnectIdentityReviewRequiredError();
  }

  return {
    profileId: profile.id,
    accountId: profile.account_id,
    countryCode: profile.country_code,
    legacyStripeAccountId,
    connect,
  };
}
