import {
  NextResponse,
} from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_SPLIT_REFUND_STATUS_API_13_28

type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};

type RunRow = {
  id:
    string;

  batch_id:
    string;

  client_profile_id:
    string;

  status:
    string;

  total_amount_cents:
    number;

  currency:
    string;

  payment_unit_count:
    number;
};

type UnitRow = {
  id:
    string;

  provider_profile_id:
    string;

  amount_cents:
    number;

  currency:
    string;

  status:
    string;

  refund_status:
    string;

  refunded_amount_cents:
    number;

  stripe_refund_id:
    string | null;

  refund_failure_reason:
    string | null;

  refund_updated_at:
    string | null;
};

export async function GET(
  request:
    Request,

  context:
    RouteContext
) {
  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const {
      id:
        batchId,
    } =
      await context.params;

    const {
      data:
        runData,

      error:
        runError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_payment_runs"
        )
        .select(
          "id, batch_id, client_profile_id, status, total_amount_cents, currency, payment_unit_count"
        )
        .eq(
          "batch_id",
          batchId
        )
        .eq(
          "client_profile_id",
          profile.id
        )
        .maybeSingle();

    if (runError) {
      throw new Error(
        runError.message
      );
    }

    const run =
      runData as unknown as
        RunRow |
        null;

    if (!run) {
      return NextResponse.json({
        batchId,

        paymentRunExists:
          false,

        refundTrackingActive:
          true,

        units:
          [],

        automaticRefund:
          false,

        clientDirectRefundExecution:
          false,
      });
    }

    const {
      data:
        unitData,

      error:
        unitError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_payment_units"
        )
        .select(
          "id, provider_profile_id, amount_cents, currency, status, refund_status, refunded_amount_cents, stripe_refund_id, refund_failure_reason, refund_updated_at"
        )
        .eq(
          "run_id",
          run.id
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );

    if (unitError) {
      throw new Error(
        unitError.message
      );
    }

    const units =
      (
        unitData ??
        []
      ) as unknown as
        UnitRow[];

    const totalRefunded =
      units.reduce(
        (
          total,
          unit
        ) =>
          total +
          Number(
            unit.refunded_amount_cents
          ),
        0
      );

    const refundedUnits =
      units.filter(
        (
          unit
        ) =>
          unit.refund_status ===
          "refunded"
      ).length;

    const refundInProgress =
      units.some(
        (
          unit
        ) =>
          unit.refund_status ===
          "processing"
      );

    const refundFailure =
      units.some(
        (
          unit
        ) =>
          unit.refund_status ===
          "failed"
      );

    return NextResponse.json({
      batchId:
        run.batch_id,

      runId:
        run.id,

      paymentRunExists:
        true,

      runStatus:
        run.status,

      totalAmountCents:
        Number(
          run.total_amount_cents
        ),

      totalRefundedAmountCents:
        totalRefunded,

      currency:
        run.currency,

      paymentUnitCount:
        Number(
          run.payment_unit_count
        ),

      refundedUnitCount:
        refundedUnits,

      refundInProgress,

      refundFailure,

      refundTrackingActive:
        true,

      units:
        units.map(
          (
            unit
          ) => ({
            id:
              unit.id,

            providerId:
              unit.provider_profile_id,

            amountCents:
              Number(
                unit.amount_cents
              ),

            currency:
              unit.currency,

            paymentStatus:
              unit.status,

            refundStatus:
              unit.refund_status,

            refundedAmountCents:
              Number(
                unit.refunded_amount_cents
              ),

            fullyRefunded:
              unit.refund_status ===
              "refunded",

            lastRefundId:
              unit.stripe_refund_id,

            refundFailureReason:
              unit.refund_failure_reason,

            refundUpdatedAt:
              unit.refund_updated_at,
          })
        ),

      refundExecutionPolicy:
        "cancellation_resolution_required",

      automaticCancellation:
        false,

      automaticRefund:
        false,

      clientDirectRefundExecution:
        false,

      reverseTransferRequiredForFutureExecution:
        true,

      refundApplicationFeePolicyMustBeExplicit:
        true,
    });
  }
  catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          "Impossible de lire l'état des remboursements de cette mission.",

        detail:
          error instanceof Error
            ? error.message
            : "SPLIT_REFUND_STATUS_FAILED",

        automaticRefund:
          false,
      },
      {
        status:
          500,
      }
    );
  }
}