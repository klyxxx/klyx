import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

const SHA_RE = /^[0-9a-f]{40}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type KlyxFinancialLiveState =
  | "DISABLED"
  | "CONTROLLED"
  | "GENERAL";

export type KlyxFinancialLiveAuthority = {
  authorityKey: "stripe_finance";
  state: KlyxFinancialLiveState;
  authorizedSha: string | null;
  certificationProfileId: string | null;
  reasonCode: string;
  operatorUserId: string | null;
  version: number;
  activatedAt: string | null;
  updatedAt: string;
};

type AuthorityRow = {
  authority_key: string;
  state: string;
  authorized_sha: string | null;
  certification_profile_id: string | null;
  reason_code: string;
  operator_user_id: string | null;
  version: number | string;
  activated_at: string | null;
  updated_at: string;
};

function normalizeAuthority(row: AuthorityRow): KlyxFinancialLiveAuthority {
  if (row.authority_key !== "stripe_finance") {
    throw new Error("KLYX_FINANCIAL_LIVE_AUTHORITY_KEY_INVALID");
  }

  if (
    row.state !== "DISABLED" &&
    row.state !== "CONTROLLED" &&
    row.state !== "GENERAL"
  ) {
    throw new Error("KLYX_FINANCIAL_LIVE_AUTHORITY_STATE_INVALID");
  }

  const version = Number(row.version);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("KLYX_FINANCIAL_LIVE_AUTHORITY_VERSION_INVALID");
  }

  const authorizedSha = row.authorized_sha?.trim().toLowerCase() ?? null;
  if (authorizedSha && !SHA_RE.test(authorizedSha)) {
    throw new Error("KLYX_FINANCIAL_LIVE_AUTHORITY_SHA_INVALID");
  }

  const certificationProfileId =
    row.certification_profile_id?.trim().toLowerCase() ?? null;
  if (certificationProfileId && !UUID_RE.test(certificationProfileId)) {
    throw new Error(
      "KLYX_FINANCIAL_LIVE_AUTHORITY_CERTIFICATION_PROFILE_INVALID"
    );
  }

  return {
    authorityKey: "stripe_finance",
    state: row.state,
    authorizedSha,
    certificationProfileId,
    reasonCode: row.reason_code,
    operatorUserId: row.operator_user_id,
    version,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at,
  };
}

export async function getKlyxFinancialLiveAuthority(): Promise<KlyxFinancialLiveAuthority> {
  const { data, error } = await supabaseAdmin
    .from("ops_financial_live_authority")
    .select(
      "authority_key, state, authorized_sha, certification_profile_id, reason_code, operator_user_id, version, activated_at, updated_at"
    )
    .eq("authority_key", "stripe_finance")
    .maybeSingle();

  if (error) {
    throw new Error("KLYX_FINANCIAL_LIVE_AUTHORITY_READ_FAILED", {
      cause: error,
    });
  }

  if (!data) {
    throw new Error("KLYX_FINANCIAL_LIVE_AUTHORITY_MISSING");
  }

  return normalizeAuthority(data as AuthorityRow);
}

export async function requireKlyxFinancialLiveAuthority(input: {
  deployedSha: string;
  clientProfileId: string;
}): Promise<KlyxFinancialLiveAuthority> {
  const deployedSha = input.deployedSha.trim().toLowerCase();
  const clientProfileId = input.clientProfileId.trim().toLowerCase();

  if (!SHA_RE.test(deployedSha)) {
    throw new Error("KLYX_FINANCIAL_LIVE_DEPLOYED_SHA_INVALID");
  }

  if (!UUID_RE.test(clientProfileId)) {
    throw new Error("KLYX_FINANCIAL_LIVE_CLIENT_PROFILE_INVALID");
  }

  const authority = await getKlyxFinancialLiveAuthority();

  if (authority.state === "DISABLED") {
    throw new Error("KLYX_FINANCIAL_LIVE_DISABLED");
  }

  if (authority.authorizedSha !== deployedSha) {
    throw new Error("KLYX_FINANCIAL_LIVE_SHA_MISMATCH");
  }

  if (authority.state === "CONTROLLED") {
    if (
      !authority.certificationProfileId ||
      authority.certificationProfileId !== clientProfileId
    ) {
      throw new Error("KLYX_FINANCIAL_LIVE_CONTROLLED_PROFILE_BLOCKED");
    }
  }

  return authority;
}
