import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import type { AuthenticatedAccount } from "@/lib/api-auth";
import { canReceiveSettlementForBooking } from "@/lib/economic-settlement-eligibility-server";
import {
  assertFinancialStripeWriteAuthorized,
  assertStripeObjectMode,
  getFinancialStripeRuntime,
  getProviderFinancialDestination,
} from "@/lib/financial-stripe-runtime";
import {
  assertAggregateTransferCapacity,
  calculateCumulativeGroupRefundDelta,
  validateExplicitGroupRefundAllocations,
  type GroupPartialRefundAllocationRequest,
  type GroupRefundAllocationInput,
} from "@/lib/group-multiexecutor-settlement-economics";
import {
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import { readStripeSettlementRecipientTruth } from "@/lib/stripe-settlement-recipient-truth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforcePlatformHeldGroupRefundTransactionRisk,
  enforceSettlementReleaseTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";

const PAYMENT_MODE = "platform_held_group" as const;

type ParentRow = {
  id: string;
  batch_id: string;
  client_profile_id: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  transfer_group: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  state: string;
  refunded_amount_cents: number;
};

type MemberRow = {
  id: string;
  group_settlement_id: string;
  batch_id: string;
  provider_profile_id: string;
  provider_account_id: string;
  stripe_account_id: string;
  booking_ids: unknown;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  state: string;
  release_attempt_number: number;
  release_claimed_at: string | null;
  release_claim_amount_cents: number;
  stripe_transfer_id: string | null;
  released_amount_cents: number;
  reversed_amount_cents: number;
  refunded_gross_amount_cents: number;
  refunded_platform_fee_cents: number;
  refunded_provider_amount_cents: number;
};

type ReleaseClaimRow = {
  action:
    | "create"
    | "released"
    | "busy"
    | "not_ready"
    | "review_required";
  attempt_number: number;
  batch_id: string;
  provider_profile_id: string;
  provider_account_id: string;
  stripe_account_id: string;
  provider_amount_cents: number;
  currency: string;
  stripe_charge_id: string | null;
  transfer_group: string;
};

type RefundRow = {
  id: string;
  group_settlement_id: string;
  batch_id: string;
  request_key: string;
  currency: string;
  amount_cents: number;
  state: string;
  stripe_refund_id: string | null;
};

type AllocationRow = {
  id: string;
  refund_id: string;
  member_id: string;
  gross_refund_cents: number;
  platform_fee_refund_cents: number;
  provider_refund_cents: number;
  state: string;
};

export type GroupMemberReleaseResult =
  | { status: "not_ready" | "busy" | "review_required" }
  | {
      status: "released";
      transferId: string;
      reconciled: boolean;
    };

export type GroupRefundRequest =
  | {
      kind: "total";
      requestKey: string;
    }
  | {
      kind: "partial";
      requestKey: string;
      amountCents: number;
      allocations: GroupPartialRefundAllocationRequest[];
    };

export type GroupRefundResult =
  | {
      status: "pending_reversals" | "pending_refund" | "review_required";
      refundId: string;
    }
  | {
      status: "refunded";
      refundId: string;
      stripeRefundId: string;
      reconciled: boolean;
    };


function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function transferSourceId(transfer: Stripe.Transfer): string | null {
  return stripeObjectId(transfer.source_transaction);
}

function memberExpectedTransferAmount(member: MemberRow): number {
  const released = Number(member.released_amount_cents);
  if (released > 0) return released;

  const claimed = Number(member.release_claim_amount_cents);
  if (claimed > 0) return claimed;

  return Math.max(
    Number(member.provider_amount_cents) -
      Number(member.refunded_provider_amount_cents),
    0
  );
}

async function loadParentByBatch(batchId: string): Promise<ParentRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlements")
    .select(
      "id, batch_id, client_profile_id, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, transfer_group, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, state, refunded_amount_cents"
    )
    .eq("batch_id", batchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_GROUP_HELD_PARENT_NOT_FOUND");
  return data as ParentRow;
}

async function loadParent(parentId: string): Promise<ParentRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlements")
    .select(
      "id, batch_id, client_profile_id, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, transfer_group, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, state, refunded_amount_cents"
    )
    .eq("id", parentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_GROUP_HELD_PARENT_NOT_FOUND");
  return data as ParentRow;
}

async function loadMember(memberId: string): Promise<MemberRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlement_members")
    .select(
      "id, group_settlement_id, batch_id, provider_profile_id, provider_account_id, stripe_account_id, booking_ids, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, state, release_attempt_number, release_claimed_at, release_claim_amount_cents, stripe_transfer_id, released_amount_cents, reversed_amount_cents, refunded_gross_amount_cents, refunded_platform_fee_cents, refunded_provider_amount_cents"
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_GROUP_HELD_MEMBER_NOT_FOUND");
  return data as MemberRow;
}

async function markParentReview(parentId: string, code: string, message: string) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_group_review",
    {
      p_group_settlement_id: parentId,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

async function markMemberReview(memberId: string, code: string, message: string) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_group_member_review",
    {
      p_member_id: memberId,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

function verifyMemberTransfer(input: {
  transfer: Stripe.Transfer;
  parent: ParentRow;
  member: MemberRow;
  expectedAmountCents?: number;
}) {
  const { transfer, parent, member } = input;
  const expectedAmountCents =
    input.expectedAmountCents ?? memberExpectedTransferAmount(member);

  assertStripeObjectMode(transfer.livemode, getFinancialStripeRuntime());
  if (
    transfer.metadata?.payment_mode !== PAYMENT_MODE ||
    transfer.metadata?.split_batch_id !== parent.batch_id ||
    transfer.metadata?.group_settlement_id !== parent.id ||
    transfer.metadata?.group_settlement_member_id !== member.id ||
    expectedAmountCents <= 0 ||
    transfer.amount !== expectedAmountCents ||
    transfer.currency.toUpperCase() !== parent.currency ||
    stripeObjectId(transfer.destination) !== member.stripe_account_id ||
    transferSourceId(transfer) !== parent.stripe_charge_id ||
    transfer.transfer_group !== parent.transfer_group
  ) {
    throw new Error("KLYX_GROUP_HELD_MEMBER_TRANSFER_TRUTH_MISMATCH");
  }
}

async function listAndValidateTransfers(
  stripe: Stripe,
  parent: ParentRow,
  members: MemberRow[]
) {
  if (!parent.stripe_charge_id) {
    throw new Error("KLYX_GROUP_HELD_SOURCE_CHARGE_REQUIRED");
  }

  const listed = await stripe.transfers.list({
    transfer_group: parent.transfer_group,
    limit: 100,
  });

  const memberById = new Map(members.map((member) => [member.id, member]));
  const byMember = new Map<string, Stripe.Transfer[]>();
  let grossTotal = 0;
  let netTotal = 0;

  for (const transfer of listed.data) {
    assertStripeObjectMode(transfer.livemode, getFinancialStripeRuntime());

    const memberId = transfer.metadata?.group_settlement_member_id?.trim() ?? "";
    const member = memberById.get(memberId);

    if (
      !member ||
      transfer.metadata?.payment_mode !== PAYMENT_MODE ||
      transfer.metadata?.split_batch_id !== parent.batch_id ||
      transfer.metadata?.group_settlement_id !== parent.id ||
      transferSourceId(transfer) !== parent.stripe_charge_id ||
      transfer.transfer_group !== parent.transfer_group ||
      transfer.currency.toUpperCase() !== parent.currency
    ) {
      throw new Error("KLYX_GROUP_HELD_UNKNOWN_OR_DIVERGENT_TRANSFER");
    }

    verifyMemberTransfer({ transfer, parent, member });
    grossTotal += transfer.amount;
    netTotal += Math.max(
      transfer.amount - Number(transfer.amount_reversed ?? 0),
      0
    );

    const existing = byMember.get(member.id) ?? [];
    existing.push(transfer);
    byMember.set(member.id, existing);
  }

  const currentProviderEntitlement = members.reduce(
    (sum, member) =>
      sum +
      Math.max(
        Number(member.provider_amount_cents) -
          Number(member.refunded_provider_amount_cents),
        0
      ),
    0
  );

  if (grossTotal > Number(parent.provider_amount_cents)) {
    throw new Error("KLYX_GROUP_HELD_REMOTE_OVERTRANSFER");
  }

  if (netTotal > currentProviderEntitlement) {
    throw new Error("KLYX_GROUP_HELD_REMOTE_NET_OVERTRANSFER");
  }

  for (const [memberId, transfers] of byMember) {
    if (transfers.length > 1) {
      throw new Error(
        `KLYX_GROUP_HELD_MULTIPLE_MEMBER_TRANSFERS:${memberId}`
      );
    }
  }

  return {
    byMember,
    grossTotal,
    netTotal,
    currentProviderEntitlement,
  };
}

function memberBookingIds(member: MemberRow): string[] {
  if (!Array.isArray(member.booking_ids)) {
    throw new Error("KLYX_GROUP_HELD_MEMBER_BOOKING_IDS_INVALID");
  }

  const bookingIds = member.booking_ids
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (bookingIds.length === 0 || bookingIds.length !== member.booking_ids.length) {
    throw new Error("KLYX_GROUP_HELD_MEMBER_BOOKING_IDS_INVALID");
  }

  return Array.from(new Set(bookingIds));
}

async function evaluateMemberEconomicSettlementEligibility(
  member: MemberRow
): Promise<{ allowed: boolean; reasonCodes: string[] }> {
  const results = await Promise.all(
    memberBookingIds(member).map((bookingId) =>
      canReceiveSettlementForBooking({
        accountId: member.provider_account_id,
        bookingId,
        expectedProviderProfileId: member.provider_profile_id,
        expectedStripeAccountId: member.stripe_account_id,
      })
    )
  );

  const reasonCodes: string[] = [];

  for (const result of results) {
    if (!result) {
      reasonCodes.push("economic_settlement_context_missing");
      continue;
    }

    if (result.decision !== "allowed") {
      reasonCodes.push(result.decision, ...result.reasonCodes);
    }
  }

  return {
    allowed: reasonCodes.length === 0,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}

async function loadAllMembers(parentId: string): Promise<MemberRow[]> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlement_members")
    .select(
      "id, group_settlement_id, batch_id, provider_profile_id, provider_account_id, stripe_account_id, booking_ids, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, state, release_attempt_number, release_claimed_at, release_claim_amount_cents, stripe_transfer_id, released_amount_cents, reversed_amount_cents, refunded_gross_amount_cents, refunded_platform_fee_cents, refunded_provider_amount_cents"
    )
    .eq("group_settlement_id", parentId);

  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}

async function reconcileMemberRelease(memberId: string, transferId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_reconcile_platform_held_group_member_release",
    {
      p_member_id: memberId,
      p_stripe_transfer_id: transferId,
    }
  );
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_HELD_RELEASE_RECONCILE_LOST");
}

async function reopenExpiredClaimAfterNoTransfer(memberId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_reopen_platform_held_group_member_release_after_no_transfer",
    { p_member_id: memberId }
  );
  if (error) throw new Error(error.message);
  return data === true;
}

async function failReleaseClaim(
  memberId: string,
  claimToken: string,
  code: string,
  message: string
) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_fail_platform_held_group_member_release",
    {
      p_member_id: memberId,
      p_claim_token: claimToken,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

export async function releasePlatformHeldGroupMember(
  memberId: string
): Promise<GroupMemberReleaseResult> {
  const stripeRuntime = getFinancialStripeRuntime();
  const stripe = stripeRuntime.stripe;
  let member = await loadMember(memberId);
  const parent = await loadParent(member.group_settlement_id);

  if (
    !parent.stripe_charge_id ||
    !["held", "release_partial", "released", "partially_refunded"].includes(
      parent.state
    )
  ) {
    return { status: "not_ready" };
  }

  let members = await loadAllMembers(parent.id);

  let remote;
  try {
    remote = await listAndValidateTransfers(stripe, parent, members);
  } catch (error) {
    await markParentReview(
      parent.id,
      "group_transfer_truth_divergence",
      error instanceof Error ? error.message : "Group Transfer truth diverged."
    );
    return { status: "review_required" };
  }

  const existing = remote.byMember.get(member.id)?.[0] ?? null;
  if (existing) {
    await reconcileMemberRelease(member.id, existing.id);
    return { status: "released", transferId: existing.id, reconciled: true };
  }

  if (member.state === "release_claimed") {
    const claimedAt = member.release_claimed_at
      ? Date.parse(member.release_claimed_at)
      : Number.NaN;
    const stale =
      Number.isFinite(claimedAt) &&
      claimedAt <= Date.now() - 10 * 60 * 1000;

    if (!stale) return { status: "busy" };

    const reopened = await reopenExpiredClaimAfterNoTransfer(member.id);
    if (!reopened) return { status: "busy" };
    member = await loadMember(member.id);
  }

  const economicEligibility =
    await evaluateMemberEconomicSettlementEligibility(member);

  if (!economicEligibility.allowed) {
    await markMemberReview(
      member.id,
      "economic_settlement_eligibility_denied",
      economicEligibility.reasonCodes.join(",") ||
        "Economic settlement eligibility did not allow release."
    );
    return { status: "review_required" };
  }

  try {
    await enforceSettlementReleaseTransactionRisk({
      recipientProfileId: member.provider_profile_id,
      subjectType: "split_batch",
      subjectId: parent.batch_id,
    });
  } catch (error) {
    if (!isTransactionRiskGateError(error)) throw error;

    await markMemberReview(
      member.id,
      error.decision,
      error.reasonCodes.join(",") || error.code
    );
    return { status: "review_required" };
  }

  try {
    const destination = await getProviderFinancialDestination(
      member.provider_profile_id,
      stripeRuntime.mode
    );

    if (
      destination.accountId !== member.provider_account_id ||
      destination.connect.state !== "linked" ||
      destination.connect.stripeAccountId !== member.stripe_account_id
    ) {
      await markMemberReview(
        member.id,
        "canonical_stripe_identity_changed",
        "Canonical Stripe destination no longer matches frozen member settlement."
      );
      return { status: "review_required" };
    }

  } catch (error) {
    if (!isStripeConnectIdentityReviewRequired(error)) throw error;

    await markMemberReview(
      member.id,
      "canonical_stripe_identity_review_required",
      error.message
    );
    return { status: "review_required" };
  }

  const claimToken = randomUUID();
  const { data: claimData, error: claimError } = await supabaseAdmin.rpc(
    "klyx_claim_platform_held_group_member_release",
    {
      p_member_id: member.id,
      p_claim_token: claimToken,
    }
  );

  if (claimError) throw new Error(claimError.message);
  const claim = ((claimData ?? []) as ReleaseClaimRow[])[0];
  if (!claim) throw new Error("KLYX_GROUP_HELD_RELEASE_CLAIM_MISSING");

  if (claim.action === "released") {
    const refreshed = await loadMember(member.id);
    if (!refreshed.stripe_transfer_id) {
      throw new Error("KLYX_GROUP_HELD_RELEASED_WITHOUT_TRANSFER");
    }
    return {
      status: "released",
      transferId: refreshed.stripe_transfer_id,
      reconciled: true,
    };
  }
  if (claim.action === "busy" || claim.action === "not_ready") {
    return { status: claim.action };
  }
  if (claim.action === "review_required") {
    await markMemberReview(
      member.id,
      "group_member_release_review_required",
      "Member release claim requires review."
    );
    return { status: "review_required" };
  }

  let stripeWriteAttempted = false;

  try {
    member = await loadMember(member.id);
    members = await loadAllMembers(parent.id);
    remote = await listAndValidateTransfers(stripe, parent, members);

    const appeared = remote.byMember.get(member.id)?.[0] ?? null;
    if (appeared) {
      await reconcileMemberRelease(member.id, appeared.id);
      return { status: "released", transferId: appeared.id, reconciled: true };
    }

    assertAggregateTransferCapacity({
      providerAmountCents: Number(parent.provider_amount_cents),
      existingStripeTransferAmountCents: remote.grossTotal,
      requestedTransferAmountCents: Number(claim.provider_amount_cents),
    });
    assertAggregateTransferCapacity({
      providerAmountCents: remote.currentProviderEntitlement,
      existingStripeTransferAmountCents: remote.netTotal,
      requestedTransferAmountCents: Number(claim.provider_amount_cents),
    });

    const revalidatedEconomicEligibility =
      await evaluateMemberEconomicSettlementEligibility(member);

    if (!revalidatedEconomicEligibility.allowed) {
      await failReleaseClaim(
        member.id,
        claimToken,
        "economic_settlement_eligibility_changed",
        revalidatedEconomicEligibility.reasonCodes.join(",") ||
          "Economic settlement eligibility changed after the atomic claim."
      );
      await markMemberReview(
        member.id,
        "economic_settlement_eligibility_changed",
        revalidatedEconomicEligibility.reasonCodes.join(",") ||
          "Economic settlement eligibility changed after the atomic claim."
      );
      return { status: "review_required" };
    }

    const stripeTruth = await readStripeSettlementRecipientTruth(
      stripe,
      member.stripe_account_id
    );

    if (
      stripeTruth.stripeAccountId !== member.stripe_account_id ||
      stripeTruth.livemode !== stripeRuntime.livemode ||
      !stripeTruth.transferCapabilityActive
    ) {
      await failReleaseClaim(
        member.id,
        claimToken,
        "stripe_recipient_not_ready_after_claim",
        "Remote Stripe recipient truth does not permit a new Transfer in the current Stripe mode."
      );
      await markMemberReview(
        member.id,
        "stripe_recipient_not_ready_after_claim",
        "Remote Stripe recipient truth does not permit a new TEST Transfer."
      );
      return { status: "review_required" };
    }

    await assertFinancialStripeWriteAuthorized({
      capability: "settlement_release",
      currency: parent.currency,
    });

    stripeWriteAttempted = true;
    const transfer = await stripe.transfers.create(
      {
        amount: Number(claim.provider_amount_cents),
        currency: parent.currency.toLowerCase(),
        destination: member.stripe_account_id,
        source_transaction: parent.stripe_charge_id,
        transfer_group: parent.transfer_group,
        metadata: {
          payment_mode: PAYMENT_MODE,
          split_batch_id: parent.batch_id,
          group_settlement_id: parent.id,
          group_settlement_member_id: member.id,
          provider_profile_id: member.provider_profile_id,
        },
      },
      {
        idempotencyKey: `klyx-platform-held-group-member-${member.id}`,
      }
    );

    verifyMemberTransfer({
      transfer,
      parent,
      member,
      expectedAmountCents: Number(claim.provider_amount_cents),
    });

    const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc(
      "klyx_finalize_platform_held_group_member_release",
      {
        p_member_id: member.id,
        p_claim_token: claimToken,
        p_stripe_transfer_id: transfer.id,
      }
    );
    if (finalizeError) throw new Error(finalizeError.message);
    if (finalized !== true) {
      throw new Error("KLYX_GROUP_HELD_RELEASE_FINALIZE_LOST");
    }

    return { status: "released", transferId: transfer.id, reconciled: false };
  } catch (error) {
    if (!stripeWriteAttempted) {
      await failReleaseClaim(
        member.id,
        claimToken,
        "group_member_release_failed_before_stripe",
        error instanceof Error ? error.message : "Member release failed."
      );
    }
    // Once Stripe was called the result can be unknown. Keep release_claimed;
    // the next pass MUST list Stripe truth before any new write.
    throw error;
  }
}

async function loadExistingRefundByRequestKey(
  parentId: string,
  requestKey: string
): Promise<RefundRow | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_refunds")
    .select(
      "id, group_settlement_id, batch_id, request_key, currency, amount_cents, state, stripe_refund_id"
    )
    .eq("group_settlement_id", parentId)
    .eq("request_key", requestKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as RefundRow) : null;
}

async function loadRefund(refundId: string): Promise<RefundRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_refunds")
    .select(
      "id, group_settlement_id, batch_id, request_key, currency, amount_cents, state, stripe_refund_id"
    )
    .eq("id", refundId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_GROUP_HELD_REFUND_NOT_FOUND");
  return data as RefundRow;
}

async function loadAllocations(refundId: string): Promise<AllocationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_refund_allocations")
    .select(
      "id, refund_id, member_id, gross_refund_cents, platform_fee_refund_cents, provider_refund_cents, state"
    )
    .eq("refund_id", refundId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AllocationRow[];
}

async function buildRemainingTotalAllocations(parent: ParentRow) {
  const members = await loadAllMembers(parent.id);
  const { data: refunds, error: refundError } = await supabaseAdmin
    .from("platform_held_group_refunds")
    .select("id, state")
    .eq("group_settlement_id", parent.id)
    .neq("state", "failed");

  if (refundError) throw new Error(refundError.message);
  const activeIds = (refunds ?? []).map((row) => String(row.id));

  const allocatedByMember = new Map<
    string,
    { gross: number; fee: number; provider: number }
  >();

  if (activeIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("platform_held_group_refund_allocations")
      .select(
        "member_id, gross_refund_cents, platform_fee_refund_cents, provider_refund_cents"
      )
      .in("refund_id", activeIds);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const memberId = String(row.member_id);
      const current = allocatedByMember.get(memberId) ?? {
        gross: 0,
        fee: 0,
        provider: 0,
      };
      current.gross += Number(row.gross_refund_cents);
      current.fee += Number(row.platform_fee_refund_cents);
      current.provider += Number(row.provider_refund_cents);
      allocatedByMember.set(memberId, current);
    }
  }

  const allocations: GroupRefundAllocationInput[] = [];

  for (const member of members) {
    const used = allocatedByMember.get(member.id) ?? {
      gross: 0,
      fee: 0,
      provider: 0,
    };
    const gross = Number(member.gross_amount_cents) - used.gross;
    const fee = Number(member.platform_fee_cents) - used.fee;
    const provider = Number(member.provider_amount_cents) - used.provider;

    if (gross < 0 || fee < 0 || provider < 0 || fee + provider !== gross) {
      throw new Error("KLYX_GROUP_HELD_TOTAL_REFUND_ACCOUNTING_DIVERGENCE");
    }

    if (gross > 0) {
      allocations.push({
        memberId: member.id,
        grossRefundCents: gross,
        platformFeeRefundCents: fee,
        providerRefundCents: provider,
      });
    }
  }

  const amountCents = allocations.reduce(
    (sum, allocation) => sum + allocation.grossRefundCents,
    0
  );

  if (amountCents <= 0) {
    throw new Error("KLYX_GROUP_HELD_NOTHING_LEFT_TO_REFUND");
  }

  return { amountCents, allocations };
}

function assertPartialRefundRequestMatchesFrozen(input: {
  request: Extract<GroupRefundRequest, { kind: "partial" }>;
  refund: RefundRow;
  allocations: AllocationRow[];
}) {
  const requested = [...input.request.allocations]
    .map((allocation) => ({
      memberId: allocation.memberId.trim(),
      grossRefundCents: allocation.grossRefundCents,
    }))
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
  const frozen = input.allocations
    .map((allocation) => ({
      memberId: allocation.member_id,
      grossRefundCents: Number(allocation.gross_refund_cents),
    }))
    .sort((a, b) => a.memberId.localeCompare(b.memberId));

  if (
    Number(input.refund.amount_cents) !== input.request.amountCents ||
    JSON.stringify(requested) !== JSON.stringify(frozen)
  ) {
    throw new Error("KLYX_GROUP_HELD_REFUND_KEY_CONFLICT");
  }
}

async function buildPartialAllocations(
  parent: ParentRow,
  amountCents: number,
  requests: readonly GroupPartialRefundAllocationRequest[]
) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    requests.length === 0
  ) {
    throw new Error("KLYX_GROUP_HELD_PARTIAL_REFUND_ALLOCATION_REQUIRED");
  }

  const memberIds = requests.map((request) => request.memberId.trim());
  if (
    memberIds.some((memberId) => !memberId) ||
    new Set(memberIds).size !== memberIds.length
  ) {
    throw new Error("KLYX_GROUP_HELD_REFUND_MEMBER_DUPLICATE");
  }

  const requestedTotal = requests.reduce(
    (sum, request) => sum + request.grossRefundCents,
    0
  );
  if (requestedTotal !== amountCents) {
    throw new Error("KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH");
  }

  const members = await loadAllMembers(parent.id);
  const memberById = new Map(members.map((member) => [member.id, member]));

  const { data: refunds, error: refundError } = await supabaseAdmin
    .from("platform_held_group_refunds")
    .select("id, state")
    .eq("group_settlement_id", parent.id)
    .neq("state", "failed");

  if (refundError) throw new Error(refundError.message);
  const activeRefundIds = (refunds ?? []).map((row) => String(row.id));

  const priorByMember = new Map<
    string,
    { gross: number; fee: number; provider: number }
  >();

  if (activeRefundIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("platform_held_group_refund_allocations")
      .select(
        "member_id, gross_refund_cents, platform_fee_refund_cents, provider_refund_cents"
      )
      .in("refund_id", activeRefundIds);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const memberId = String(row.member_id);
      const prior = priorByMember.get(memberId) ?? {
        gross: 0,
        fee: 0,
        provider: 0,
      };
      prior.gross += Number(row.gross_refund_cents);
      prior.fee += Number(row.platform_fee_refund_cents);
      prior.provider += Number(row.provider_refund_cents);
      priorByMember.set(memberId, prior);
    }
  }

  const allocations: GroupRefundAllocationInput[] = requests.map((request) => {
    const memberId = request.memberId.trim();
    const member = memberById.get(memberId);
    if (!member) {
      throw new Error("KLYX_GROUP_HELD_REFUND_MEMBER_INVALID");
    }

    const prior = priorByMember.get(memberId) ?? {
      gross: 0,
      fee: 0,
      provider: 0,
    };

    const delta = calculateCumulativeGroupRefundDelta({
      memberGrossAmountCents: Number(member.gross_amount_cents),
      memberPlatformFeeCents: Number(member.platform_fee_cents),
      priorGrossRefundCents: prior.gross,
      priorPlatformFeeRefundCents: prior.fee,
      priorProviderRefundCents: prior.provider,
      requestedGrossRefundCents: request.grossRefundCents,
    });

    return {
      memberId,
      grossRefundCents: delta.grossRefundCents,
      platformFeeRefundCents: delta.platformFeeRefundCents,
      providerRefundCents: delta.providerRefundCents,
    };
  });

  validateExplicitGroupRefundAllocations({
    refundAmountCents: amountCents,
    allocations,
  });

  return { amountCents, allocations };
}

async function markRefundReview(
  refundId: string,
  code: string,
  message: string
) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_group_refund_review",
    {
      p_refund_id: refundId,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

async function markAllocationReview(
  allocationId: string,
  code: string,
  message: string
) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_group_refund_allocation_review",
    {
      p_allocation_id: allocationId,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

async function processRequiredReversals(input: {
  stripe: Stripe;
  parent: ParentRow;
  refund: RefundRow;
  allocations: AllocationRow[];
}) {
  let pending = false;

  for (const allocation of input.allocations) {
    if (allocation.state !== "reversal_required") continue;

    const member = await loadMember(allocation.member_id);
    const transferId = member.stripe_transfer_id;

    if (!transferId || allocation.provider_refund_cents <= 0) {
      await markAllocationReview(
        allocation.id,
        "group_refund_transfer_truth_missing",
        "A reversal-required allocation has no frozen member Transfer."
      );
      continue;
    }

    const transfer = await input.stripe.transfers.retrieve(transferId);
    verifyMemberTransfer({ transfer, parent: input.parent, member });

    const reversals = await input.stripe.transfers.listReversals(transferId, {
      limit: 100,
    });
    const matching = reversals.data.filter(
      (candidate) =>
        candidate.metadata?.group_refund_allocation_id === allocation.id
    );

    if (matching.length > 1) {
      await markAllocationReview(
        allocation.id,
        "multiple_group_member_reversals",
        "Multiple Stripe reversals exist for one refund allocation."
      );
      continue;
    }

    let reversal = matching[0] ?? null;

    if (reversal && reversal.amount !== Number(allocation.provider_refund_cents)) {
      await markAllocationReview(
        allocation.id,
        "group_member_reversal_amount_mismatch",
        "Existing Stripe reversal amount differs from frozen refund allocation."
      );
      continue;
    }

    if (!reversal) {
      try {
        await assertFinancialStripeWriteAuthorized({
          capability: "refunds",
          currency: input.parent.currency,
        });

        reversal = await input.stripe.transfers.createReversal(
          transferId,
          {
            amount: Number(allocation.provider_refund_cents),
            metadata: {
              payment_mode: PAYMENT_MODE,
              split_batch_id: input.parent.batch_id,
              group_settlement_id: input.parent.id,
              group_settlement_member_id: member.id,
              group_refund_id: input.refund.id,
              group_refund_allocation_id: allocation.id,
            },
          },
          {
            idempotencyKey: `klyx-platform-held-group-reversal-${allocation.id}`,
          }
        );
      } catch {
        // Leave this allocation reversal_required. A later attempt will list
        // Stripe truth first, so a lost response can never create a blind second
        // reversal. Other members continue independently.
        pending = true;
        continue;
      }
    }

    const { data, error } = await supabaseAdmin.rpc(
      "klyx_finalize_platform_held_group_member_reversal",
      {
        p_allocation_id: allocation.id,
        p_stripe_transfer_id: transferId,
        p_stripe_transfer_reversal_id: reversal.id,
        p_amount_cents: Number(allocation.provider_refund_cents),
      }
    );
    if (error) throw new Error(error.message);
    if (data !== true) {
      await markAllocationReview(
        allocation.id,
        "group_member_reversal_finalize_lost",
        "Stripe reversal exists but the allocation could not be finalized."
      );
    }
  }

  return pending;
}

async function listExistingRefundTruth(
  stripe: Stripe,
  parent: ParentRow,
  refund: RefundRow
) {
  if (!parent.stripe_charge_id) {
    throw new Error("KLYX_GROUP_HELD_SOURCE_CHARGE_REQUIRED");
  }

  const listed = await stripe.refunds.list({
    charge: parent.stripe_charge_id,
    limit: 100,
  });

  const matching = listed.data.filter(
    (candidate) => candidate.metadata?.group_refund_id === refund.id
  );

  if (matching.length > 1) {
    throw new Error("KLYX_GROUP_HELD_MULTIPLE_REFUNDS_FOR_REQUEST");
  }

  for (const candidate of listed.data) {
    if (
      candidate.metadata?.payment_mode !== PAYMENT_MODE ||
      candidate.metadata?.split_batch_id !== parent.batch_id ||
      candidate.metadata?.group_settlement_id !== parent.id
    ) {
      throw new Error("KLYX_GROUP_HELD_UNKNOWN_REFUND_ON_CHARGE");
    }
  }

  const remoteTotal = listed.data
    .filter((candidate) => candidate.status !== "failed")
    .reduce((sum, candidate) => sum + candidate.amount, 0);

  if (remoteTotal > Number(parent.gross_amount_cents)) {
    throw new Error("KLYX_GROUP_HELD_REMOTE_REFUND_EXCEEDS_GROSS");
  }

  return { existing: matching[0] ?? null, remoteTotal };
}

async function finalizeRefund(
  refund: RefundRow,
  stripeRefund: Stripe.Refund
) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_platform_held_group_refund",
    {
      p_refund_id: refund.id,
      p_stripe_refund_id: stripeRefund.id,
      p_amount_cents: stripeRefund.amount,
      p_currency: stripeRefund.currency.toUpperCase(),
    }
  );
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_HELD_REFUND_FINALIZE_LOST");
}

export async function refundPlatformHeldGroup(input: {
  batchId: string;
  requesterAccount: AuthenticatedAccount;
  requesterProfileId: string;
  request: GroupRefundRequest;
}): Promise<GroupRefundResult> {
  const stripeRuntime = getFinancialStripeRuntime();
  const stripe = stripeRuntime.stripe;
  const parent = await loadParentByBatch(input.batchId);

  if (parent.client_profile_id !== input.requesterProfileId) {
    throw new Error("KLYX_GROUP_HELD_REFUND_FORBIDDEN");
  }

  let refund = await loadExistingRefundByRequestKey(
    parent.id,
    input.request.requestKey
  );

  if (
    !parent.stripe_charge_id ||
    ["pending_payment", "review_required"].includes(parent.state) ||
    (parent.state === "refunded" && !refund)
  ) {
    throw new Error("KLYX_GROUP_HELD_REFUND_NOT_READY");
  }

  await enforcePlatformHeldGroupRefundTransactionRisk({
    requesterAccount: input.requesterAccount,
    subjectId: parent.batch_id,
  });
  let allocations: AllocationRow[];

  if (refund) {
    allocations = await loadAllocations(refund.id);
  } else {
    const desired =
      input.request.kind === "total"
        ? await buildRemainingTotalAllocations(parent)
        : await buildPartialAllocations(
            parent,
            input.request.amountCents,
            input.request.allocations
          );

    validateExplicitGroupRefundAllocations({
      refundAmountCents: desired.amountCents,
      allocations: desired.allocations,
    });

    const { data: refundId, error: createError } = await supabaseAdmin.rpc(
      "klyx_create_platform_held_group_refund_plan",
      {
        p_batch_id: parent.batch_id,
        p_request_key: input.request.requestKey,
        p_amount_cents: desired.amountCents,
        p_currency: parent.currency,
        p_allocations: desired.allocations.map((allocation) => ({
          member_id: allocation.memberId,
          gross_refund_cents: allocation.grossRefundCents,
          platform_fee_refund_cents: allocation.platformFeeRefundCents,
          provider_refund_cents: allocation.providerRefundCents,
        })),
      }
    );

    if (createError) throw new Error(createError.message);
    if (typeof refundId !== "string") {
      throw new Error("KLYX_GROUP_HELD_REFUND_PLAN_NOT_CREATED");
    }

    refund = await loadRefund(refundId);
    allocations = await loadAllocations(refund.id);
  }

  // Revalidate after the SQL create-or-reuse boundary as well. This covers two
  // concurrent callers that both observed no plan before one of them won the
  // parent-row lock and froze the request key.
  if (input.request.kind === "partial") {
    assertPartialRefundRequestMatchesFrozen({
      request: input.request,
      refund,
      allocations,
    });
  }

  const reversalPending = await processRequiredReversals({
    stripe,
    parent,
    refund,
    allocations,
  });

  refund = await loadRefund(refund.id);
  allocations = await loadAllocations(refund.id);

  if (
    refund.state === "review_required" ||
    allocations.some((allocation) => allocation.state === "review_required")
  ) {
    return { status: "review_required", refundId: refund.id };
  }

  if (
    reversalPending ||
    allocations.some((allocation) => allocation.state === "reversal_required")
  ) {
    return { status: "pending_reversals", refundId: refund.id };
  }

  let remote;
  try {
    remote = await listExistingRefundTruth(stripe, parent, refund);
  } catch (error) {
    await markRefundReview(
      refund.id,
      "group_refund_truth_divergence",
      error instanceof Error ? error.message : "Group refund truth diverged."
    );
    return { status: "review_required", refundId: refund.id };
  }

  let stripeRefund = remote.existing;
  const reconciled = Boolean(stripeRefund);

  if (stripeRefund) {
    if (
      stripeRefund.amount !== Number(refund.amount_cents) ||
      stripeRefund.currency.toUpperCase() !== refund.currency
    ) {
      await markRefundReview(
        refund.id,
        "group_refund_amount_currency_mismatch",
        "Existing Stripe refund differs from frozen refund plan."
      );
      return { status: "review_required", refundId: refund.id };
    }

    if (stripeRefund.status === "succeeded") {
      await finalizeRefund(refund, stripeRefund);
      return {
        status: "refunded",
        refundId: refund.id,
        stripeRefundId: stripeRefund.id,
        reconciled: true,
      };
    }

    if (stripeRefund.status === "pending") {
      return { status: "pending_refund", refundId: refund.id };
    }

    if (stripeRefund.status === "failed") {
      const { error } = await supabaseAdmin.rpc(
        "klyx_fail_platform_held_group_refund",
        {
          p_refund_id: refund.id,
          p_error_code: "stripe_refund_failed",
          p_error_message: stripeRefund.failure_reason ?? "Stripe refund failed.",
        }
      );
      if (error) throw new Error(error.message);
      throw new Error("KLYX_GROUP_HELD_STRIPE_REFUND_FAILED");
    }
  }

  if (
    remote.remoteTotal + Number(refund.amount_cents) >
    Number(parent.gross_amount_cents)
  ) {
    await markRefundReview(
      refund.id,
      "group_refund_aggregate_exceeds_gross",
      "Remote refund total plus requested refund exceeds the frozen group charge."
    );
    return { status: "review_required", refundId: refund.id };
  }

  const { data: inflight, error: inflightError } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_group_refund_inflight",
    { p_refund_id: refund.id }
  );
  if (inflightError) throw new Error(inflightError.message);
  if (inflight !== true) {
    return { status: "pending_reversals", refundId: refund.id };
  }

  try {
    await assertFinancialStripeWriteAuthorized({
      capability: "refunds",
      currency: parent.currency,
    });

    stripeRefund = await stripe.refunds.create(
      {
        charge: parent.stripe_charge_id,
        amount: Number(refund.amount_cents),
        metadata: {
          payment_mode: PAYMENT_MODE,
          split_batch_id: parent.batch_id,
          group_settlement_id: parent.id,
          group_refund_id: refund.id,
          request_key: refund.request_key,
        },
      },
      {
        idempotencyKey: `klyx-platform-held-group-refund-${refund.id}`,
      }
    );
  } catch {
    // Unknown result stays refunding. The next attempt lists Stripe refunds by
    // charge + immutable refund id before using the same idempotency key.
    return { status: "pending_refund", refundId: refund.id };
  }

  if (stripeRefund.status === "succeeded") {
    await finalizeRefund(refund, stripeRefund);
    return {
      status: "refunded",
      refundId: refund.id,
      stripeRefundId: stripeRefund.id,
      reconciled,
    };
  }

  if (stripeRefund.status === "pending") {
    return { status: "pending_refund", refundId: refund.id };
  }

  const { error: failError } = await supabaseAdmin.rpc(
    "klyx_fail_platform_held_group_refund",
    {
      p_refund_id: refund.id,
      p_error_code: "stripe_refund_failed",
      p_error_message: stripeRefund.failure_reason ?? "Stripe refund failed.",
    }
  );
  if (failError) throw new Error(failError.message);
  throw new Error("KLYX_GROUP_HELD_STRIPE_REFUND_FAILED");
}


export async function reconcilePlatformHeldGroupRefundFromStripe(
  stripeRefund: Stripe.Refund
): Promise<boolean> {
  if (
    stripeRefund.metadata?.payment_mode !== PAYMENT_MODE ||
    !stripeRefund.metadata?.group_refund_id ||
    !stripeRefund.metadata?.group_settlement_id ||
    !stripeRefund.metadata?.split_batch_id
  ) {
    return false;
  }

  const stripe = testStripeClient();
  const refund = await loadRefund(stripeRefund.metadata.group_refund_id);
  const parent = await loadParent(refund.group_settlement_id);
  const chargeId = stripeObjectId(stripeRefund.charge);

  if (
    refund.id !== stripeRefund.metadata.group_refund_id ||
    parent.id !== stripeRefund.metadata.group_settlement_id ||
    parent.batch_id !== stripeRefund.metadata.split_batch_id ||
    !chargeId ||
    chargeId !== parent.stripe_charge_id ||
    stripeRefund.amount !== Number(refund.amount_cents) ||
    stripeRefund.currency.toUpperCase() !== refund.currency
  ) {
    await markRefundReview(
      refund.id,
      "group_refund_webhook_truth_mismatch",
      "Stripe refund webhook differs from frozen KLYX group refund truth."
    );
    return true;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  assertStripeObjectMode(charge.livemode, stripeRuntime);

  if (stripeRefund.status === "succeeded") {
    await finalizeRefund(refund, stripeRefund);
    return true;
  }

  if (stripeRefund.status === "failed") {
    const { error } = await supabaseAdmin.rpc(
      "klyx_fail_platform_held_group_refund",
      {
        p_refund_id: refund.id,
        p_error_code: "stripe_refund_failed",
        p_error_message:
          stripeRefund.failure_reason ?? "Stripe group refund failed.",
      }
    );
    if (error) throw new Error(error.message);
    return true;
  }

  return true;
}
