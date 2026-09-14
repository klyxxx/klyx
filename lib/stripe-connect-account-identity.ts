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

type HistoricalProfileRow = {
  id: string;
  stripe_account_id: string | null;
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

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  ).sort();
}

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

async function readCanonicalIdentity(accountId: string): Promise<IdentityRow | null> {
  const { data, error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select(
      "account_id, stripe_account_id, identity_state, source_profile_ids, conflicting_stripe_account_ids"
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IdentityRow | null) ?? null;
}

async function readHistoricalIdentity(accountId: string): Promise<{
  profileIds: string[];
  stripeAccountIds: string[];
}> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, stripe_account_id")
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as HistoricalProfileRow[];
  return {
    profileIds: uniqueSorted(rows.map((row) => row.id)),
    stripeAccountIds: uniqueSorted(rows.map((row) => row.stripe_account_id)),
  };
}

async function writeLinkedIdentity(params: {
  accountId: string;
  stripeAccountId: string;
  sourceProfileIds: string[];
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .upsert(
      {
        account_id: params.accountId,
        stripe_account_id: params.stripeAccountId,
        identity_state: "linked",
        source_profile_ids: uniqueSorted(params.sourceProfileIds),
        conflicting_stripe_account_ids: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );

  if (error) {
    if (error.code === "23505") {
      throw new Error(STRIPE_CONNECT_IDENTITY_CONFLICT);
    }
    throw new Error(error.message);
  }
}

export async function markAccountStripeConnectIdentityForReview(params: {
  accountId: string;
  stripeAccountIds: string[];
  sourceProfileIds?: string[];
}): Promise<void> {
  const stripeAccountIds = uniqueSorted(params.stripeAccountIds);

  if (stripeAccountIds.length < 1) {
    throw new Error(STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED);
  }

  const { error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .upsert(
      {
        account_id: params.accountId,
        stripe_account_id: null,
        identity_state: "conflict",
        source_profile_ids: uniqueSorted(params.sourceProfileIds ?? []),
        conflicting_stripe_account_ids: stripeAccountIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );

  if (error) throw new Error(error.message);
}

export async function getAccountStripeConnectIdentity(
  accountId: string
): Promise<AccountStripeConnectIdentity> {
  const [canonical, history] = await Promise.all([
    readCanonicalIdentity(accountId),
    readHistoricalIdentity(accountId),
  ]);

  if (canonical?.identity_state === "conflict") {
    const conflicts = uniqueSorted([
      ...(canonical.conflicting_stripe_account_ids ?? []),
      ...history.stripeAccountIds,
    ]);

    if (
      conflicts.length > 0 &&
      (conflicts.length !== (canonical.conflicting_stripe_account_ids ?? []).length ||
        history.profileIds.some(
          (profileId) => !(canonical.source_profile_ids ?? []).includes(profileId)
        ))
    ) {
      await markAccountStripeConnectIdentityForReview({
        accountId,
        stripeAccountIds: conflicts,
        sourceProfileIds: uniqueSorted([
          ...(canonical.source_profile_ids ?? []),
          ...history.profileIds,
        ]),
      });
    }

    return {
      accountId,
      state: "conflict",
      stripeAccountId: null,
      sourceProfileIds: uniqueSorted([
        ...(canonical.source_profile_ids ?? []),
        ...history.profileIds,
      ]),
      conflictingStripeAccountIds: conflicts,
    };
  }

  const canonicalStripeId = canonical?.stripe_account_id?.trim() || null;
  const evidence = uniqueSorted([
    canonicalStripeId,
    ...history.stripeAccountIds,
  ]);
  const sourceProfileIds = uniqueSorted([
    ...(canonical?.source_profile_ids ?? []),
    ...history.profileIds,
  ]);

  if (evidence.length > 1) {
    await markAccountStripeConnectIdentityForReview({
      accountId,
      stripeAccountIds: evidence,
      sourceProfileIds,
    });

    return {
      accountId,
      state: "conflict",
      stripeAccountId: null,
      sourceProfileIds,
      conflictingStripeAccountIds: evidence,
    };
  }

  if (evidence.length === 1) {
    const stripeAccountId = evidence[0];

    if (
      !canonical ||
      canonical.identity_state !== "linked" ||
      canonical.stripe_account_id !== stripeAccountId ||
      sourceProfileIds.some(
        (profileId) => !(canonical.source_profile_ids ?? []).includes(profileId)
      )
    ) {
      await writeLinkedIdentity({
        accountId,
        stripeAccountId,
        sourceProfileIds,
      });
    }

    return {
      accountId,
      state: "linked",
      stripeAccountId,
      sourceProfileIds,
      conflictingStripeAccountIds: [],
    };
  }

  return normalizeIdentity(accountId, canonical);
}

export async function getProfileAccountStripeConnectIdentity(
  profileId: string
): Promise<AccountStripeConnectIdentity> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);

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
    await markAccountStripeConnectIdentityForReview({
      accountId: params.accountId,
      stripeAccountIds: [
        current.stripeAccountId ?? "",
        params.stripeAccountId,
      ],
      sourceProfileIds: [
        ...current.sourceProfileIds,
        params.sourceProfileId,
      ],
    });
    throw new Error(STRIPE_CONNECT_IDENTITY_CONFLICT);
  }

  await writeLinkedIdentity({
    accountId: params.accountId,
    stripeAccountId: params.stripeAccountId,
    sourceProfileIds: [
      ...current.sourceProfileIds,
      params.sourceProfileId,
    ],
  });
}
