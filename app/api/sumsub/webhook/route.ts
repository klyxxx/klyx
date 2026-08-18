import { NextResponse } from "next/server";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";
import {
  logServerError,
} from "@/lib/server-log";
import {
  hashWebhookPayload,
  verifySumsubWebhook,
} from "@/lib/sumsub";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SumsubWebhook = {
  applicantId?: string;
  externalUserId?: string;
  type?: string;
  reviewStatus?: string;
  sandboxMode?: boolean;
  reviewResult?: {
    reviewAnswer?: string;
    reviewRejectType?: string;
    moderationComment?: string;
    clientComment?: string;
    rejectLabels?: string[];
  };
};

function finalStatus(
  payload: SumsubWebhook
): {
  status: string;
  identityStatus: string;
  addressStatus: string;
  trustLevel: string;
  title: string;
  message: string;
} | null {
  if (
    payload.type !==
    "applicantReviewed"
  ) {
    return null;
  }

  const answer =
    payload.reviewResult
      ?.reviewAnswer;

  if (answer === "GREEN") {
    return {
      status: "approved",
      identityStatus: "approved",
      addressStatus: "approved",
      trustLevel: "identity_verified",
      title: "Vérification Sumsub réussie",
      message:
        "Ton identité et les contrôles obligatoires du niveau KLYX ont été validés.",
    };
  }

  if (answer === "RED") {
    const retry =
      payload.reviewResult
        ?.reviewRejectType === "RETRY";

    return {
      status: retry
        ? "changes_required"
        : "rejected",
      identityStatus: "rejected",
      addressStatus: "rejected",
      trustLevel: "new",
      title: retry
        ? "Vérification à reprendre"
        : "Vérification refusée",
      message:
        payload.reviewResult
          ?.moderationComment ||
        (retry
          ? "Sumsub demande de nouvelles informations ou de nouveaux documents."
          : "Sumsub n'a pas validé le dossier."),
    };
  }

  return null;
}

export async function POST(
  request: Request
) {
  const startedAt =
    Date.now();
  let rawBody: string;
  let valid: boolean;

  try {
    rawBody =
      await request.text();
    valid = verifySumsubWebhook({
      rawBody,
      digest:
        request.headers.get(
          "x-payload-digest"
        ),
      algorithm:
        request.headers.get(
          "x-payload-digest-alg"
        ),
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event:
        "sumsub_webhook_configuration_failed",
      route:
        "/api/sumsub/webhook",
      method: "POST",
      code:
        "sumsub_webhook_configuration_failed",
      status: 500,
      startedAt,
    });
  }

  if (!valid) {
    return NextResponse.json(
      {
        error:
          "Signature Sumsub invalide.",
      },
      { status: 401 }
    );
  }

  const eventHash =
    hashWebhookPayload(rawBody);

  let payload: SumsubWebhook;

  try {
    payload =
      JSON.parse(rawBody) as SumsubWebhook;
  } catch {
    return NextResponse.json(
      { error: "Payload invalide." },
      { status: 400 }
    );
  }

  const {
    error: insertEventError,
  } = await supabaseAdmin
    .from("sumsub_webhook_events")
    .insert({
      event_hash: eventHash,
      event_type:
        payload.type ?? null,
      applicant_id:
        payload.applicantId ?? null,
      external_user_id:
        payload.externalUserId ??
        null,
      review_status:
        payload.reviewStatus ?? null,
      review_answer:
        payload.reviewResult
          ?.reviewAnswer ?? null,
      sandbox_mode:
        payload.sandboxMode ?? null,
      processed: false,
    });

  if (
    insertEventError &&
    insertEventError.code === "23505"
  ) {
    return NextResponse.json({
      received: true,
      duplicate: true,
    });
  }

  if (insertEventError) {
    return secureApiErrorResponse({
      error:
        insertEventError,
      event:
        "sumsub_webhook_claim_failed",
      route:
        "/api/sumsub/webhook",
      method: "POST",
      code:
        "sumsub_webhook_claim_failed",
      status: 500,
      startedAt,
    });
  }

  try {
    const profileId =
      payload.externalUserId?.trim();

    if (!profileId) {
      throw new Error(
        "externalUserId manquant."
      );
    }

    const now =
      new Date().toISOString();

    const commonUpdate = {
      external_provider: "sumsub",
      external_applicant_id:
        payload.applicantId ?? null,
      external_review_status:
        payload.reviewStatus ?? null,
      external_review_answer:
        payload.reviewResult
          ?.reviewAnswer ?? null,
      external_reject_type:
        payload.reviewResult
          ?.reviewRejectType ?? null,
      external_moderation_comment:
        payload.reviewResult
          ?.moderationComment ?? null,
      external_sandbox_mode:
        payload.sandboxMode ?? null,
      external_updated_at: now,
      updated_at: now,
    };

    const { data: existing, error: existingError } =
      await supabaseAdmin
        .from("provider_verifications")
        .select("id")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message
      );
    }

    if (existing) {
      const { error } =
        await supabaseAdmin
          .from("provider_verifications")
          .update(commonUpdate)
          .eq("id", existing.id);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } =
        await supabaseAdmin
          .from("provider_verifications")
          .insert({
            profile_id: profileId,
            status: "under_review",
            identity_status:
              "under_review",
            address_status:
              "under_review",
            trust_level: "new",
            ...commonUpdate,
          });

      if (error) {
        throw new Error(error.message);
      }
    }

    const decision =
      finalStatus(payload);

    if (decision) {
      const { error: decisionError } =
        await supabaseAdmin
          .from("provider_verifications")
          .update({
            status:
              decision.status,
            identity_status:
              decision.identityStatus,
            address_status:
              decision.addressStatus,
            trust_level:
              decision.trustLevel,
            reviewed_at: now,
            review_note:
              decision.message,
            updated_at: now,
          })
          .eq(
            "profile_id",
            profileId
          );

      if (decisionError) {
        throw new Error(
          decisionError.message
        );
      }

      const { error: notificationError } =
        await supabaseAdmin
          .from("user_notifications")
          .insert({
            user_id: profileId,
            type: "system",
            title: decision.title,
            message: decision.message,
            href:
              "/provider/verification/sumsub",
            deduplication_key:
              `sumsub:${payload.applicantId ?? profileId}:${payload.reviewResult?.reviewAnswer ?? "status"}:${eventHash}`,
          });

      if (notificationError) {
        logServerError({
          event:
            "sumsub_notification_failed",
          route:
            "/api/sumsub/webhook",
          method: "POST",
          status: 500,
          code:
            "sumsub_notification_failed",
          error:
            notificationError,
        });
      }
    }

    const {
      error: eventUpdateError,
    } = await supabaseAdmin
      .from("sumsub_webhook_events")
      .update({
        processed: true,
        processed_at: now,
        last_error: null,
      })
      .eq(
        "event_hash",
        eventHash
      );

    if (eventUpdateError) {
      throw new Error(
        eventUpdateError.message
      );
    }

    return NextResponse.json({
      received: true,
      processed: true,
    });
  } catch (error) {
    await supabaseAdmin
      .from("sumsub_webhook_events")
      .update({
        processed: false,
        last_error:
          "sumsub_webhook_processing_failed",
      })
      .eq(
        "event_hash",
        eventHash
      );

    return secureApiErrorResponse({
      error,
      event:
        "sumsub_webhook_processing_failed",
      route:
        "/api/sumsub/webhook",
      method: "POST",
      code:
        "sumsub_webhook_processing_failed",
      status: 500,
      startedAt,
    });
  }
}
