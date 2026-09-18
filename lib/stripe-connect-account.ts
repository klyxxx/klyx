import "server-only";

import {
  getAccountStripeConnectIdentity,
  STRIPE_CONNECT_IDENTITY_CONFLICT as CANONICAL_STRIPE_CONNECT_IDENTITY_CONFLICT,
  STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED as CANONICAL_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
} from "@/lib/stripe-connect-account-identity";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED =
  CANONICAL_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED;

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

type CompatibilityProfileRow = {
  id: string;
  country_code: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
};

type ProviderProfileRow = CompatibilityProfileRow & {
  account_id: string | null;
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
      (error.message.includes(CANONICAL_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED) ||
        error.message.includes(CANONICAL_STRIPE_CONNECT_IDENTITY_CONFLICT)))
  );
}

async function loadCompatibilityProfiles(
  accountId: string
): Promise<CompatibilityProfileRow[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, country_code, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
    )
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);
  return (data ?? []) as CompatibilityProfileRow[];
}

function compatibilityReadiness(rows: CompatibilityProfileRow[]) {
  if (rows.length === 0) {
    return {
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  return {
    onboardingComplete: rows.every(
      (row) => row.stripe_onboarding_complete === true
    ),
    chargesEnabled: rows.every((row) => row.stripe_charges_enabled === true),
    payoutsEnabled: rows.every((row) => row.stripe_payouts_enabled === true),
  };
}

export async function getCanonicalStripeConnect(
  accountId: string
): Promise<CanonicalStripeConnect> {
  const compatibilityProfiles = await loadCompatibilityProfiles(accountId);
  const readiness = compatibilityReadiness(compatibilityProfiles);

  try {
    const identity = await getAccountStripeConnectIdentity(accountId);

    if (identity.state === "conflict") {
      return {
        accountId,
        stripeAccountId: null,
        state: "review_required",
        ...readiness,
        statusUpdatedAt: null,
      };
    }

    return {
      accountId,
      stripeAccountId:
        identity.state === "linked" ? identity.stripeAccountId : null,
      state: identity.state,
      ...readiness,
      statusUpdatedAt: null,
    };
  } catch (error) {
    if (isStripeConnectIdentityReviewRequired(error)) {
      return {
        accountId,
        stripeAccountId: null,
        state: "review_required",
        ...readiness,
        statusUpdatedAt: null,
      };
    }

    throw error;
  }
}

export async function getProviderStripeDestination(
  profileId: string
): Promise<ProviderStripeDestination> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, account_id, country_code, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
    )
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Prestataire introuvable.");

  const profile = data as ProviderProfileRow;

  if (!profile.account_id) {
    throw new StripeConnectIdentityReviewRequiredError(
      "Le prestataire n'est pas rattaché à un compte KLYX canonique."
    );
  }

  const connect = await getCanonicalStripeConnect(profile.account_id);

  if (connect.state === "review_required") {
    throw new StripeConnectIdentityReviewRequiredError();
  }

  return {
    profileId: profile.id,
    accountId: profile.account_id,
    countryCode: profile.country_code,
    // Historical compatibility only. Never use this value as Stripe authority.
    legacyStripeAccountId: profile.stripe_account_id,
    connect,
  };
}
