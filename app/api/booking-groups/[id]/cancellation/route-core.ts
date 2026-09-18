import {
  NextResponse,
} from "next/server";

import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

import {
  secureApiErrorResponse,
} from "@/lib/api-error";

import {
  logServerWarning,
} from "@/lib/server-log";

import {
  tryReconcileBookingGroupStripeRefund,
} from "@/lib/stripe-group-refunds";

import {
  assertStripeRuntimeReady,
} from "@/lib/stripe-runtime";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_GROUP_CANCELLATION_RESOLUTION_API_12_90

type ParticipantRole =
  | "client"
  | "provider";

type GroupRow = {
  id: string;
  market_request_id: string | null;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  payment_mode: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  refunded_amount_cents: number | null;
  refunded_at: string | null;
  cancellation_request_status: string;
  cancellation_requested_by: string | null;
  cancellation_requested_role: ParticipantRole | null;
  cancellation_reason: string | null;
  cancellation_requested_at: string | null;
  cancellation_withdrawn_at: string | null;
  cancellation_resolution: string;
  cancellation_resolved_by: string | null;
  cancellation_resolved_at: string | null;
  refund_status: string;
};

type RouteContext = {
  params:
    Promise<{
      id: string;
    }>;
};

function roleFor(
  group: GroupRow,
  profileId: string
): ParticipantRole | null {
  if (
    group.client_profile_id ===
    profileId
  ) {
    return "client";
  }

  if (
    group.provider_profile_id ===
    profileId
  ) {
    return "provider";
  }

  return null;
}

function otherParticipant(
  group: GroupRow,
  role: ParticipantRole
) {
  return role ===
    "client"
    ? group.provider_profile_id
    : group.client_profile_id;
}

async function loadGroup(
  groupId: string
): Promise<GroupRow> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "booking_groups"
    )
    .select(
      "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, payment_mode, stripe_payment_intent_id, stripe_refund_id, refunded_amount_cents, refunded_at, cancellation_request_status, cancellation_requested_by, cancellation_requested_role, cancellation_reason, cancellation_requested_at, cancellation_withdrawn_at, cancellation_resolution, cancellation_resolved_by, cancellation_resolved_at, refund_status"
    )
    .eq(
      "id",
      groupId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!data) {
    throw new Error(
      "Mission groupee introuvable."
    );
  }

  return data as unknown as GroupRow;
}

async function preflightCancellation(
  groupId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, status, service_status, provider_finished_at"
    )
    .eq(
      "booking_group_id",
      groupId
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  const started =
    (
      data ??
      []
    ).some(
      (booking) =>
        booking.status ===
          "completed" ||
        Boolean(
          booking.provider_finished_at
        ) ||
        [
          "en_route",
          "arrived",
          "in_progress",
          "completed",
        ].includes(
          booking.service_status ??
            ""
        )
    );

  if (started) {
    throw new Error(
      "Au moins un creneau a deja commence ou est termine. Le remboursement total du groupe est bloque."
    );
  }
}

function publicState(
  group: GroupRow,
  role: ParticipantRole,
  profileId: string
) {
  const pending =
    group.cancellation_request_status ===
    "requested";

  const requester =
    pending &&
    group.cancellation_requested_by ===
      profileId;

  const responder =
    pending &&
    group.cancellation_requested_by !==
      profileId;

  return {
    groupId:
      group.id,

    role,

    groupStatus:
      group.status,

    paymentStatus:
      group.payment_status,

    cancellationStatus:
      group.cancellation_request_status,

    resolution:
      group.cancellation_resolution,

    requestedBy:
      group.cancellation_requested_by,

    requestedRole:
      group.cancellation_requested_role,

    reason:
      group.cancellation_reason,

    requestedAt:
      group.cancellation_requested_at,

    withdrawnAt:
      group.cancellation_withdrawn_at,

    resolvedBy:
      group.cancellation_resolved_by,

    resolvedAt:
      group.cancellation_resolved_at,

    refundStatus:
      group.refund_status,

    stripeRefundId:
      group.stripe_refund_id,

    refundedAmountCents:
      group.refunded_amount_cents,

    refundedAt:
      group.refunded_at,

    isRequester:
      requester,

    canRequest:
      !pending &&
      ![
        "cancelled",
        "completed",
      ].includes(
        group.status
      ),

    canWithdraw:
      requester,

    canApprove:
      responder,

    canReject:
      responder,

    automaticCancellation:
      false,

    automaticRefund:
      false,
  };
}

async function audit(
  params: {
    groupId: string;
    actorId: string;
    actorRole:
      | ParticipantRole
      | "system";
    action: string;
    reason: string | null;
  }
) {
  const {
    error,
  } = await supabaseAdmin
    .from(
      "booking_group_cancellation_events"
    )
    .insert({
      booking_group_id:
        params.groupId,

      actor_profile_id:
        params.actorId,

      actor_role:
        params.actorRole,

      action:
        params.action,

      reason:
        params.reason,
    });

  if (error) {
    logServerWarning({
      event:
        "booking_group_cancellation_audit_failed",
      route:
        "/api/booking-groups/[id]/cancellation",
      method: "POST",
      status: 500,
      code:
        "booking_group_cancellation_audit_failed",
    });
  }
}

async function notify(
  params: {
    group: GroupRow;
    userId: string;
    title: string;
    message: string;
    key: string;
  }
) {
  const {
    error,
  } = await supabaseAdmin
    .from(
      "user_notifications"
    )
    .upsert(
      {
        user_id:
          params.userId,

        market_request_id:
          params.group
            .market_request_id,

        type:
          "system",

        title:
          params.title,

        message:
          params.message,

        href:
          "/booking-groups/" +
          params.group.id,

        deduplication_key:
          params.key,
      },
      {
        onConflict:
          "deduplication_key",

        ignoreDuplicates:
          true,
      }
    );

  if (error) {
    logServerWarning({
      event:
        "booking_group_cancellation_notification_failed",
      route:
        "/api/booking-groups/[id]/cancellation",
      method: "POST",
      status: 500,
      code:
        "booking_group_cancellation_notification_failed",
    });
  }
}

function stripeKey() {
  const value =
    process.env
      .STRIPE_SECRET_KEY
      ?.trim();

  if (!value) {
    throw new Error(
      "STRIPE_SECRET_KEY manquante."
    );
  }

  return value;
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const startedAt =
    Date.now();

  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    const {
      id,
    } =
      await context.params;

    const group =
      await loadGroup(
        id
      );

    const role =
      roleFor(
        group,
        profile.id
      );

    if (!role) {
      return NextResponse.json(
        {
          error:
            "Acces refuse.",
        },
        {
          status: 403,
        }
      );
    }

    return NextResponse.json(
      publicState(
        group,
        role,
        profile.id
      )
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chargement impossible.";

    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "booking_group_cancellation_read_failed",
      route:
        "/api/booking-groups/[id]/cancellation",
      method: "GET",
      status,
      code:
        "booking_group_cancellation_read_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const startedAt =
    Date.now();

  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    const {
      id,
    } =
      await context.params;

    const body =
      (await request.json()) as {
        action?:
          | "request"
          | "withdraw"
          | "approve"
          | "reject";

        reason?: string;
      };

    const action =
      body.action;

    if (
      action !== "request" &&
      action !== "withdraw" &&
      action !== "approve" &&
      action !== "reject"
    ) {
      return NextResponse.json(
        {
          error:
            "Action invalide.",
        },
        {
          status: 400,
        }
      );
    }

    let group =
      await loadGroup(
        id
      );

    const role =
      roleFor(
        group,
        profile.id
      );

    if (!role) {
      return NextResponse.json(
        {
          error:
            "Acces refuse.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      action === "request"
    ) {
      await preflightCancellation(
        group.id
      );

      if (
        group.cancellation_request_status ===
        "requested"
      ) {
        return NextResponse.json(
          {
            error:
              "Une demande d annulation est deja ouverte.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        [
          "cancelled",
          "completed",
        ].includes(
          group.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Cette mission ne peut plus etre annulee.",
          },
          {
            status: 409,
          }
        );
      }

      const reason =
        body.reason
          ?.trim()
          .slice(
            0,
            500
          ) ??
        "";

      if (
        reason.length < 10
      ) {
        return NextResponse.json(
          {
            error:
              "Explique la raison en au moins 10 caracteres.",
          },
          {
            status: 400,
          }
        );
      }

      const now =
        new Date()
          .toISOString();

      const {
        error,
      } = await supabaseAdmin
        .from(
          "booking_groups"
        )
        .update({
          cancellation_request_status:
            "requested",

          cancellation_requested_by:
            profile.id,

          cancellation_requested_role:
            role,

          cancellation_reason:
            reason,

          cancellation_requested_at:
            now,

          cancellation_withdrawn_at:
            null,

          cancellation_resolution:
            "none",

          cancellation_resolved_by:
            null,

          cancellation_resolved_at:
            null,

          refund_status:
            group.payment_status ===
            "paid"
              ? "review_required"
              : "not_required",

          updated_at:
            now,
        })
        .eq(
          "id",
          group.id
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await audit({
        groupId:
          group.id,

        actorId:
          profile.id,

        actorRole:
          role,

        action:
          "requested",

        reason,
      });

      await notify({
        group,

        userId:
          otherParticipant(
            group,
            role
          ),

        title:
          "Annulation groupee a examiner",

        message:
          group.payment_status ===
          "paid"
            ? "Une demande concerne toute la mission deja payee. Ton accord explicite est requis avant tout remboursement."
            : "Une demande concerne toute la mission. Ton accord explicite est requis.",

        key:
          "booking-group:" +
          group.id +
          ":cancel-request:" +
          now,
      });

      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          "Demande envoyee. Rien n a encore ete annule ou rembourse.",
      });
    }

    if (
      action === "withdraw"
    ) {
      if (
        group.cancellation_request_status !==
          "requested" ||
        group.cancellation_requested_by !==
          profile.id
      ) {
        return NextResponse.json(
          {
            error:
              "Tu ne peux pas retirer cette demande.",
          },
          {
            status: 403,
          }
        );
      }

      const now =
        new Date()
          .toISOString();

      const {
        error,
      } = await supabaseAdmin
        .from(
          "booking_groups"
        )
        .update({
          cancellation_request_status:
            "withdrawn",

          cancellation_withdrawn_at:
            now,

          refund_status:
            "not_required",

          updated_at:
            now,
        })
        .eq(
          "id",
          group.id
        )
        .eq(
          "cancellation_request_status",
          "requested"
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await audit({
        groupId:
          group.id,

        actorId:
          profile.id,

        actorRole:
          role,

        action:
          "withdrawn",

        reason:
          group.cancellation_reason,
      });

      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          "Demande retiree.",
      });
    }

    if (
      group.cancellation_requested_by ===
      profile.id
    ) {
      return NextResponse.json(
        {
          error:
            "La personne qui demande l annulation ne peut pas accepter sa propre demande.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      action === "approve"
    ) {
      await preflightCancellation(
        group.id
      );
    }

    const {
      data:
        resolutionData,

      error:
        resolutionError,
    } = await supabaseAdmin
      .rpc(
        "klyx_resolve_group_cancellation",
        {
          p_group_id:
            group.id,

          p_actor_profile_id:
            profile.id,

          p_decision:
            action ===
            "approve"
              ? "approve"
              : "reject",
        }
      );

    if (resolutionError) {
      throw new Error(
        resolutionError.message
      );
    }

    const resolution =
      String(
        resolutionData ??
        ""
      );

    if (
      action === "reject"
    ) {
      await audit({
        groupId:
          group.id,

        actorId:
          profile.id,

        actorRole:
          role,

        action:
          "rejected",

        reason:
          group.cancellation_reason,
      });

      if (
        group.cancellation_requested_by
      ) {
        await notify({
          group,

          userId:
            group.cancellation_requested_by,

          title:
            "Annulation groupee refusee",

          message:
            "L autre participant a refuse la demande. La mission reste active.",

          key:
            "booking-group:" +
            group.id +
            ":cancel-rejected",
        });
      }

      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          "Demande refusee. Aucun remboursement effectue.",
      });
    }

    await audit({
      groupId:
        group.id,

      actorId:
        profile.id,

      actorRole:
        role,

      action:
        "approved",

      reason:
        group.cancellation_reason,
    });

    if (
      resolution ===
      "cancelled"
    ) {
      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          "Annulation acceptee. Le groupe non paye est annule.",
      });
    }

    if (
      resolution ===
      "already_refunded"
    ) {
      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          "Cette mission est deja remboursee.",
      });
    }

    if (
      resolution ===
      "already_approved"
    ) {
      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          "Cette annulation est deja approuvee.",
      });
    }

    if (
      resolution !==
      "refund"
    ) {
      throw new Error(
        "Etat de resolution KLYX inattendu : " +
        resolution
      );
    }

    group =
      await loadGroup(
        group.id
      );

    if (
      !group.stripe_payment_intent_id
    ) {
      throw new Error(
        "PaymentIntent Stripe du groupe introuvable."
      );
    }

    assertStripeRuntimeReady();

    const stripe =
      new Stripe(
        stripeKey()
      );

    try {
      const destinationCharge =
        group.payment_mode ===
        "connect_destination";

      const refund =
        await stripe.refunds.create(
          {
            payment_intent:
              group.stripe_payment_intent_id,

            reason:
              "requested_by_customer",

            metadata: {
              booking_group_id:
                group.id,

              cancellation_resolution:
                "approved",
            },

            ...(destinationCharge
              ? {
                  reverse_transfer:
                    true,

                  refund_application_fee:
                    true,
                }
              : {}),
          },
          {
            idempotencyKey:
              "klyx-group-refund-" +
              group.id,
          }
        );

      await audit({
        groupId:
          group.id,

        actorId:
          profile.id,

        actorRole:
          role,

        action:
          "refund_started",

        reason:
          group.cancellation_reason,
      });

      await tryReconcileBookingGroupStripeRefund(
        refund
      );

      group =
        await loadGroup(
          group.id
        );

      return NextResponse.json({
        ...publicState(
          group,
          role,
          profile.id
        ),

        message:
          group.refund_status ===
          "refunded"
            ? "Stripe a rembourse toute la mission groupee."
            : "Le remboursement unique est en cours chez Stripe.",
      });
    } catch (error) {
      await supabaseAdmin
        .from(
          "booking_groups"
        )
        .update({
          refund_status:
            "failed",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          group.id
        );

      throw error;
    }
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "Resolution impossible.";

    const message =
      raw.includes(
        "KLYX_GROUP_CANCEL_SELF_APPROVAL"
      )
        ? "Tu ne peux pas approuver ta propre demande d annulation."
        : raw.includes(
              "KLYX_GROUP_CANCEL_NOT_PENDING"
            )
          ? "Cette demande a deja ete traitee."
          : raw.includes(
                "KLYX_GROUP_CANCEL_PAYMENT_INTENT_MISSING"
              )
            ? "Le paiement Stripe du groupe est introuvable."
            : raw;

    const status =
      raw.includes(
        "KLYX_GROUP_CANCEL_SELF_APPROVAL"
      ) ||
      raw.includes(
        "KLYX_GROUP_CANCEL_NOT_PENDING"
      ) ||
      raw.includes(
        "KLYX_GROUP_CANCEL_PAYMENT_INTENT_MISSING"
      )
        ? 409
        : apiErrorStatus(
            raw
          );

    return secureApiErrorResponse({
      error,
      event:
        "booking_group_cancellation_update_failed",
      route:
        "/api/booking-groups/[id]/cancellation",
      method: "POST",
      status,
      code:
        "booking_group_cancellation_update_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}
