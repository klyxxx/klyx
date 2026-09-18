import { calculateKlyxEconomics } from "@/lib/klyx-economics";

export type GroupExecutorInput = {
  providerProfileId: string;
  providerAccountId: string;
  stripeAccountId: string;
  bookingIds: readonly string[];
  grossAmountCents: number;
  currency: string;
};

export type FrozenGroupExecutorSettlement = {
  providerProfileId: string;
  providerAccountId: string;
  stripeAccountId: string;
  bookingIds: string[];
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  currency: string;
};

export type FrozenGroupSettlementPlan = {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  currency: string;
  members: FrozenGroupExecutorSettlement[];
};

export type GroupRefundAllocationInput = {
  memberId: string;
  grossRefundCents: number;
  platformFeeRefundCents: number;
  providerRefundCents: number;
};

function assertCents(value: number, code: string, allowZero = true) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    throw new Error(code);
  }
}

export function freezeMultiExecutorGroupEconomics(input: {
  executors: readonly GroupExecutorInput[];
  commissionPercent?: number;
}): FrozenGroupSettlementPlan {
  if (input.executors.length < 2) {
    throw new Error("KLYX_GROUP_HELD_EXECUTOR_COUNT_INVALID");
  }

  const providerIds = new Set<string>();
  const stripeAccountIds = new Set<string>();
  const bookingIds = new Set<string>();
  let currency = "";

  const members = input.executors.map((executor) => {
    const providerProfileId = executor.providerProfileId.trim();
    const providerAccountId = executor.providerAccountId.trim();
    const stripeAccountId = executor.stripeAccountId.trim();
    const memberCurrency = executor.currency.trim().toUpperCase();
    const memberBookingIds = Array.from(
      new Set(executor.bookingIds.map((value) => value.trim()).filter(Boolean))
    ).sort();

    if (
      !providerProfileId ||
      !providerAccountId ||
      !stripeAccountId.startsWith("acct_") ||
      memberCurrency.length !== 3 ||
      memberBookingIds.length === 0
    ) {
      throw new Error("KLYX_GROUP_HELD_EXECUTOR_INVALID");
    }

    assertCents(
      executor.grossAmountCents,
      "KLYX_GROUP_HELD_MEMBER_GROSS_INVALID",
      false
    );

    if (providerIds.has(providerProfileId)) {
      throw new Error("KLYX_GROUP_HELD_EXECUTOR_DUPLICATE");
    }
    providerIds.add(providerProfileId);

    if (stripeAccountIds.has(stripeAccountId)) {
      throw new Error("KLYX_GROUP_HELD_STRIPE_DESTINATION_DUPLICATE");
    }
    stripeAccountIds.add(stripeAccountId);

    for (const bookingId of memberBookingIds) {
      if (bookingIds.has(bookingId)) {
        throw new Error("KLYX_GROUP_HELD_BOOKING_DUPLICATE");
      }
      bookingIds.add(bookingId);
    }

    if (!currency) {
      currency = memberCurrency;
    } else if (currency !== memberCurrency) {
      throw new Error("KLYX_GROUP_HELD_CURRENCY_MISMATCH");
    }

    const economics = calculateKlyxEconomics(
      executor.grossAmountCents,
      input.commissionPercent
    );

    return {
      providerProfileId,
      providerAccountId,
      stripeAccountId,
      bookingIds: memberBookingIds,
      grossAmountCents: economics.grossAmountCents,
      platformFeeCents: economics.platformFeeCents,
      providerAmountCents: economics.providerAmountCents,
      currency: memberCurrency,
    };
  });

  const totals = members.reduce(
    (accumulator, member) => ({
      grossAmountCents:
        accumulator.grossAmountCents + member.grossAmountCents,
      platformFeeCents:
        accumulator.platformFeeCents + member.platformFeeCents,
      providerAmountCents:
        accumulator.providerAmountCents + member.providerAmountCents,
    }),
    {
      grossAmountCents: 0,
      platformFeeCents: 0,
      providerAmountCents: 0,
    }
  );

  if (
    totals.platformFeeCents + totals.providerAmountCents !==
    totals.grossAmountCents
  ) {
    throw new Error("KLYX_GROUP_HELD_PARENT_ECONOMICS_MISMATCH");
  }

  return {
    ...totals,
    currency,
    members,
  };
}

export function assertAggregateTransferCapacity(input: {
  providerAmountCents: number;
  existingStripeTransferAmountCents: number;
  requestedTransferAmountCents: number;
}) {
  assertCents(
    input.providerAmountCents,
    "KLYX_GROUP_HELD_PROVIDER_TOTAL_INVALID"
  );
  assertCents(
    input.existingStripeTransferAmountCents,
    "KLYX_GROUP_HELD_REMOTE_TRANSFER_TOTAL_INVALID"
  );
  assertCents(
    input.requestedTransferAmountCents,
    "KLYX_GROUP_HELD_TRANSFER_AMOUNT_INVALID",
    false
  );

  if (
    input.existingStripeTransferAmountCents >
      input.providerAmountCents ||
    input.existingStripeTransferAmountCents +
      input.requestedTransferAmountCents >
      input.providerAmountCents
  ) {
    throw new Error("KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD");
  }
}

export function validateExplicitGroupRefundAllocations(input: {
  refundAmountCents: number;
  allocations: readonly GroupRefundAllocationInput[];
}) {
  assertCents(
    input.refundAmountCents,
    "KLYX_GROUP_HELD_REFUND_AMOUNT_INVALID",
    false
  );

  if (input.allocations.length === 0) {
    throw new Error("KLYX_GROUP_HELD_REFUND_ALLOCATION_REQUIRED");
  }

  const memberIds = new Set<string>();
  let gross = 0;
  let fee = 0;
  let provider = 0;

  for (const allocation of input.allocations) {
    const memberId = allocation.memberId.trim();
    if (!memberId || memberIds.has(memberId)) {
      throw new Error("KLYX_GROUP_HELD_REFUND_MEMBER_DUPLICATE");
    }
    memberIds.add(memberId);

    assertCents(
      allocation.grossRefundCents,
      "KLYX_GROUP_HELD_REFUND_MEMBER_GROSS_INVALID",
      false
    );
    assertCents(
      allocation.platformFeeRefundCents,
      "KLYX_GROUP_HELD_REFUND_MEMBER_FEE_INVALID"
    );
    assertCents(
      allocation.providerRefundCents,
      "KLYX_GROUP_HELD_REFUND_MEMBER_PROVIDER_INVALID"
    );

    if (
      allocation.platformFeeRefundCents +
        allocation.providerRefundCents !==
      allocation.grossRefundCents
    ) {
      throw new Error("KLYX_GROUP_HELD_REFUND_MEMBER_ECONOMICS_MISMATCH");
    }

    gross += allocation.grossRefundCents;
    fee += allocation.platformFeeRefundCents;
    provider += allocation.providerRefundCents;
  }

  if (gross !== input.refundAmountCents || fee + provider !== gross) {
    throw new Error("KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH");
  }

  return {
    grossRefundCents: gross,
    platformFeeRefundCents: fee,
    providerRefundCents: provider,
  };
}
