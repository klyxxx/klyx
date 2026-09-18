import { describe, expect, it } from "vitest";

import {
  assertAggregateTransferCapacity,
  calculateCumulativeGroupRefundDelta,
  freezeMultiExecutorGroupEconomics,
  validateExplicitGroupRefundAllocations,
} from "@/lib/group-multiexecutor-settlement-economics";

describe("multi-executor platform-held group economics", () => {
  it("freezes exact member and parent accounting with member-level rounding", () => {
    const plan = freezeMultiExecutorGroupEconomics({
      commissionPercent: 15,
      executors: [
        {
          providerProfileId: "provider-a",
          providerAccountId: "account-a",
          stripeAccountId: "acct_A",
          bookingIds: ["booking-1", "booking-2"],
          grossAmountCents: 1001,
          currency: "eur",
        },
        {
          providerProfileId: "provider-b",
          providerAccountId: "account-b",
          stripeAccountId: "acct_B",
          bookingIds: ["booking-3"],
          grossAmountCents: 2002,
          currency: "EUR",
        },
      ],
    });

    expect(plan.members).toEqual([
      expect.objectContaining({
        providerProfileId: "provider-a",
        grossAmountCents: 1001,
        platformFeeCents: 150,
        providerAmountCents: 851,
        currency: "EUR",
      }),
      expect.objectContaining({
        providerProfileId: "provider-b",
        grossAmountCents: 2002,
        platformFeeCents: 300,
        providerAmountCents: 1702,
        currency: "EUR",
      }),
    ]);

    expect(plan).toMatchObject({
      grossAmountCents: 3003,
      platformFeeCents: 450,
      providerAmountCents: 2553,
      currency: "EUR",
    });
    expect(plan.platformFeeCents + plan.providerAmountCents).toBe(
      plan.grossAmountCents
    );
    expect(
      plan.members.reduce((sum, member) => sum + member.grossAmountCents, 0)
    ).toBe(plan.grossAmountCents);
    expect(
      plan.members.reduce((sum, member) => sum + member.platformFeeCents, 0)
    ).toBe(plan.platformFeeCents);
    expect(
      plan.members.reduce((sum, member) => sum + member.providerAmountCents, 0)
    ).toBe(plan.providerAmountCents);
  });

  it("rejects duplicate providers, Stripe destinations, bookings and currencies", () => {
    const base = [
      {
        providerProfileId: "provider-a",
        providerAccountId: "account-a",
        stripeAccountId: "acct_A",
        bookingIds: ["booking-1"],
        grossAmountCents: 1000,
        currency: "EUR",
      },
      {
        providerProfileId: "provider-b",
        providerAccountId: "account-b",
        stripeAccountId: "acct_B",
        bookingIds: ["booking-2"],
        grossAmountCents: 2000,
        currency: "EUR",
      },
    ];

    expect(() =>
      freezeMultiExecutorGroupEconomics({
        executors: [base[0], { ...base[1], providerProfileId: "provider-a" }],
      })
    ).toThrow("KLYX_GROUP_HELD_EXECUTOR_DUPLICATE");

    expect(() =>
      freezeMultiExecutorGroupEconomics({
        executors: [base[0], { ...base[1], stripeAccountId: "acct_A" }],
      })
    ).toThrow("KLYX_GROUP_HELD_STRIPE_DESTINATION_DUPLICATE");

    expect(() =>
      freezeMultiExecutorGroupEconomics({
        executors: [base[0], { ...base[1], bookingIds: ["booking-1"] }],
      })
    ).toThrow("KLYX_GROUP_HELD_BOOKING_DUPLICATE");

    expect(() =>
      freezeMultiExecutorGroupEconomics({
        executors: [base[0], { ...base[1], currency: "USD" }],
      })
    ).toThrow("KLYX_GROUP_HELD_CURRENCY_MISMATCH");
  });

  it("prevents aggregate over-transfer before any member Transfer", () => {
    expect(() =>
      assertAggregateTransferCapacity({
        providerAmountCents: 5000,
        existingStripeTransferAmountCents: 3000,
        requestedTransferAmountCents: 2000,
      })
    ).not.toThrow();

    expect(() =>
      assertAggregateTransferCapacity({
        providerAmountCents: 5000,
        existingStripeTransferAmountCents: 3000,
        requestedTransferAmountCents: 2001,
      })
    ).toThrow("KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD");
  });

  it("allocates partial refunds cumulatively without penny drift", () => {
    const first = calculateCumulativeGroupRefundDelta({
      memberGrossAmountCents: 1001,
      memberPlatformFeeCents: 150,
      priorGrossRefundCents: 0,
      priorPlatformFeeRefundCents: 0,
      priorProviderRefundCents: 0,
      requestedGrossRefundCents: 333,
    });

    expect(first).toEqual({
      grossRefundCents: 333,
      platformFeeRefundCents: 50,
      providerRefundCents: 283,
      cumulativeGrossRefundCents: 333,
      cumulativePlatformFeeRefundCents: 50,
      cumulativeProviderRefundCents: 283,
    });

    const second = calculateCumulativeGroupRefundDelta({
      memberGrossAmountCents: 1001,
      memberPlatformFeeCents: 150,
      priorGrossRefundCents: first.cumulativeGrossRefundCents,
      priorPlatformFeeRefundCents: first.cumulativePlatformFeeRefundCents,
      priorProviderRefundCents: first.cumulativeProviderRefundCents,
      requestedGrossRefundCents: 333,
    });

    const final = calculateCumulativeGroupRefundDelta({
      memberGrossAmountCents: 1001,
      memberPlatformFeeCents: 150,
      priorGrossRefundCents: second.cumulativeGrossRefundCents,
      priorPlatformFeeRefundCents: second.cumulativePlatformFeeRefundCents,
      priorProviderRefundCents: second.cumulativeProviderRefundCents,
      requestedGrossRefundCents: 335,
    });

    expect(second.platformFeeRefundCents).toBe(50);
    expect(second.providerRefundCents).toBe(283);
    expect(final.platformFeeRefundCents).toBe(50);
    expect(final.providerRefundCents).toBe(285);
    expect(final.cumulativeGrossRefundCents).toBe(1001);
    expect(final.cumulativePlatformFeeRefundCents).toBe(150);
    expect(final.cumulativeProviderRefundCents).toBe(851);

    expect(
      validateExplicitGroupRefundAllocations({
        refundAmountCents: 335,
        allocations: [
          {
            memberId: "member-a",
            grossRefundCents: final.grossRefundCents,
            platformFeeRefundCents: final.platformFeeRefundCents,
            providerRefundCents: final.providerRefundCents,
          },
        ],
      })
    ).toEqual({
      grossRefundCents: 335,
      platformFeeRefundCents: 50,
      providerRefundCents: 285,
    });
  });

  it("rejects malformed prior refund accounting and member over-refunds", () => {
    expect(() =>
      calculateCumulativeGroupRefundDelta({
        memberGrossAmountCents: 1001,
        memberPlatformFeeCents: 150,
        priorGrossRefundCents: 333,
        priorPlatformFeeRefundCents: 49,
        priorProviderRefundCents: 283,
        requestedGrossRefundCents: 100,
      })
    ).toThrow("KLYX_GROUP_HELD_REFUND_PRIOR_ACCOUNTING_MISMATCH");

    expect(() =>
      calculateCumulativeGroupRefundDelta({
        memberGrossAmountCents: 1001,
        memberPlatformFeeCents: 150,
        priorGrossRefundCents: 900,
        priorPlatformFeeRefundCents: 135,
        priorProviderRefundCents: 765,
        requestedGrossRefundCents: 102,
      })
    ).toThrow("KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_GROSS");
  });
});
