import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  refundPlatformHeldGroup,
  type GroupRefundRequest,
} from "@/lib/platform-held-group-settlement-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTransactionRiskGateError } from "@/lib/transaction-risk-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type JsonRow = Record<string, unknown>;

function asRecord(value: unknown): JsonRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRow)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cents(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const { id: batchId } = await context.params;
    const { data: parent, error: parentError } = await supabaseAdmin
      .from("platform_held_group_settlements")
      .select(
        "id, batch_id, client_profile_id, state, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, refunded_amount_cents, stripe_charge_id"
      )
      .eq("batch_id", batchId)
      .eq("client_profile_id", profile.id)
      .maybeSingle();

    if (parentError) throw new Error(parentError.message);
    if (!parent) {
      return NextResponse.json(
        { error: "Settlement groupé introuvable." },
        { status: 404 }
      );
    }

    const { data: members, error: memberError } = await supabaseAdmin
      .from("platform_held_group_settlement_members")
      .select(
        "id, provider_profile_id, state, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, reversed_amount_cents, refunded_gross_amount_cents, refunded_platform_fee_cents, refunded_provider_amount_cents, stripe_transfer_id"
      )
      .eq("group_settlement_id", parent.id)
      .order("created_at", { ascending: true });

    if (memberError) throw new Error(memberError.message);

    return NextResponse.json({
      batchId,
      groupSettlementId: parent.id,
      state: parent.state,
      currency: parent.currency,
      grossAmountCents: Number(parent.gross_amount_cents),
      platformFeeCents: Number(parent.platform_fee_cents),
      providerAmountCents: Number(parent.provider_amount_cents),
      refundedAmountCents: Number(parent.refunded_amount_cents),
      refundableAmountCents:
        Number(parent.gross_amount_cents) - Number(parent.refunded_amount_cents),
      members: members ?? [],
      partialRefundRequiresExplicitAllocation: true,
      totalRefundUsesAllRemainingFrozenEconomics: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de lire le settlement groupé.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "platform_held_group_refund_read_failed",
      route: "/api/bookings/split-missions/[id]/refund",
      method: "GET",
      status,
      code: "KLYX_GROUP_HELD_REFUND_READ_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const { id: batchId } = await context.params;
    const body = asRecord(await request.json());
    const kind = text(body?.kind);
    const requestKey = text(body?.requestKey);

    if (!requestKey || !["total", "partial"].includes(kind)) {
      return NextResponse.json(
        {
          error: "Plan de remboursement invalide.",
          code: "KLYX_GROUP_HELD_REFUND_REQUEST_INVALID",
        },
        { status: 400 }
      );
    }

    let refundRequest: GroupRefundRequest;

    if (kind === "total") {
      refundRequest = { kind: "total", requestKey };
    } else {
      const amountCents = cents(body?.amountCents);
      const rawAllocations = Array.isArray(body?.allocations)
        ? body.allocations
        : [];

      if (!amountCents || rawAllocations.length === 0) {
        return NextResponse.json(
          {
            error:
              "Un remboursement partiel exige un montant et des allocations explicites.",
            code: "KLYX_GROUP_HELD_PARTIAL_REFUND_ALLOCATION_REQUIRED",
          },
          { status: 400 }
        );
      }

      const allocations = rawAllocations.map((raw) => {
        const row = asRecord(raw);
        const memberId = text(row?.memberId);
        const grossRefundCents = cents(row?.grossRefundCents);
        const platformFeeRefundCents = cents(row?.platformFeeRefundCents);
        const providerRefundCents = cents(row?.providerRefundCents);

        if (
          !memberId ||
          grossRefundCents === null ||
          grossRefundCents <= 0 ||
          platformFeeRefundCents === null ||
          providerRefundCents === null
        ) {
          throw new Error("KLYX_GROUP_HELD_PARTIAL_REFUND_ALLOCATION_INVALID");
        }

        return {
          memberId,
          grossRefundCents,
          platformFeeRefundCents,
          providerRefundCents,
        };
      });

      refundRequest = {
        kind: "partial",
        requestKey,
        amountCents,
        allocations,
      };
    }

    const result = await refundPlatformHeldGroup({
      batchId,
      requesterAccount: account,
      requesterProfileId: profile.id,
      request: refundRequest,
    });

    return NextResponse.json(result, {
      status: result.status === "review_required" ? 409 : 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            "Ce remboursement nécessite une vérification de sécurité avant de continuer.",
          code: error.code,
          participant: error.participant,
          automaticSuspension: false,
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'exécuter le remboursement groupé.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "platform_held_group_refund_failed",
      route: "/api/bookings/split-missions/[id]/refund",
      method: "POST",
      status,
      code: "KLYX_GROUP_HELD_REFUND_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
