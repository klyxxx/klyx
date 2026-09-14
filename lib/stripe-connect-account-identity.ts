import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const STRIPE_CONNECT_IDENTITY_CONFLICT =
  "KLYX_STRIPE_CONNECT_IDENTITY_CONFLICT";
export const STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED =
  "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED";

type IdentityRow = {
  account_id: string;
  stripe_account_id: string | null;
  identity_state: "linked" | "conflict";
  source_profile_ids: string[] | null;
  conflicting_stripe_account_ids: string[] | null;
};

type ProfileAccountRow = {
  id: string;
  account_id: string | null;
};

export type AccountStripeConnectIdentity = {
  accountId: string;
  state: "unlinked" | "linked" | "conflict";
  stripeAccountId: string | null;
  sourceProfileIds: string[];
  conflictingStripeAccountIds: string[];
};

function normalizeIdentity(
  accountId: string,
  row: IdentityRow | null
): AccountStripeConnectIdentity {
  if (!row) {
    return {
      accountId,
      state: "unlinked",
      stripeAccountId: null,
      sourceProfileIds: [],
      conflictingStripeAccountIds: [],
    };
  }

  return {
    accountId: row.account_id,
    state: row.identity_state,
    stripeAccountId: row.stripe_account_id,
    sourceProfileIds: row.source_profile_ids ?? [],
    conflictingStripeAccountIds: row.conflicting_stripe_account_ids ?? [],
  };
}

export async function getAccountStripeConnectIdentity(
  accountId: string
): Promise<AccountStripeConnectIdentity> {
  const { data, error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select(
      "account_id, stripe_account_id, identity_state, source_profile_ids, conflicting_stripe_account_ids"
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeIdentity(accountId, (data as IdentityRow | null) ?? null);
}

export async function getProfileAccountStripeConnectIdentity(
  profileId: string
): Promise<AccountStripeConnectIdentity> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const profile = (data as ProfileAccountRow | null) ?? null;

  if (!profile?.account_id) {
    throw new Error("KLYX_CANONICAL_ACCOUNT_REQUIRED");
  }

  return getAccountStripeConnectIdentity(profile.account_id);
}

export function assertStripeConnectIdentityUsable(
  identity: AccountStripeConnectIdentity
): string | null {
  if (identity.state === "conflict") {
    throw new Error(STRIPE_CONNECT_IDENTITY_CONFLICT);
  }

  if (identity.state === "linked") {
    if (!identity.stripeAccountId) {
      throw new Error(STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED);
    }

    return identity.stripeAccountId;
  }

  return null;
}

export async function persistAccountStripeConnectIdentity(params: {
  accountId: string;
  stripeAccountId: string;
  sourceProfileId: string;
}): Promise<void> {
  const current = await getAccountStripeConnectIdentity(params.accountId);

  if (current.state === "conflict") {
    throw new Error(STRIPE_CONNECT_IDENTITY_CONFLICT);
  }

  if (
    current.state === "linked" &&
    current.stripeAccountId !== params.stripeAccountId
  ) {
    throw new Error(STRIPE_CONNECT_IDENTITY_CONFLICT);
  }

  const sourceProfileIds = Array.from(
    new Set([...current.sourceProfileIds, params.sourceProfileId])
  );

  const { error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .upsert(
      {
        account_id: params.accountId,
        stripe_account_id: params.stripeAccountId,
        identity_state: "linked",
        source_profile_ids: sourceProfileIds,
        conflicting_stripe_account_ids: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAccountStripeConnectIdentityForReview(params: {
  accountId: string;
  stripeAccountIds: string[];
  sourceProfileIds?: string[];
}): Promise<void> {
  const stripeAccountIds = Array.from(
    new Set(params.stripeAccountIds.map((value) => value.trim()).filter(Boolean))
  ).sort();

  if (stripeAccountIds.length < 2) {
    throw new Error(STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED);
  }

  const { error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .upsert(
      {
        account_id: params.accountId,
        stripe_account_id: null,
        identity_state: "conflict",
        source_profile_ids: Array.from(
          new Set(params.sourceProfileIds ?? [])
        ),
        conflicting_stripe_account_ids: stripeAccountIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}
