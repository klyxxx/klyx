import { after, NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import { reviewReceivedEmail } from "@/lib/email/lifecycle-templates";
import { recalculateProviderScores } from "@/lib/provider-score";
import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_GROUP_REVIEW_API_12_88

type GroupRow = {
  id: string;
  market_request_id: string;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  total_amount_cents: number;
  slot_count: number;
};

type ChildRow = {
  id: string;
  group_position: number | null;
  status: string;
  service_status: string | null;
};

type ReviewRow = {
  id: string;
  booking_id: string;
  booking_group_id: string | null;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
};

async function loadContext(groupId: string, clientId: string) {
  const { data: groupData, error: groupError } = await supabaseAdmin
    .from("booking_groups")
    .select(
      "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, total_amount_cents, slot_count"
    )
    .eq("id", groupId)
    .eq("client_profile_id", clientId)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!groupData) throw new Error("Mission groupee introuvable.");

  const group = groupData as GroupRow;

  const { data: childData, error: childError } = await supabaseAdmin
    .from("bookings")
    .select("id, group_position, status, service_status")
    .eq("booking_group_id", group.id)
    .order("group_position", { ascending: true });

  if (childError) throw childError;

  return {
    group,
    children: (childData ?? []) as ChildRow[],
  };
}

function childCompleted(child: ChildRow) {
  return child.status === "completed" || child.service_status === "completed";
}

function verifyCompletedGroup(group: GroupRow, children: ChildRow[]) {
  if (group.status !== "completed") {
    return "Tous les creneaux doivent etre termines avant de laisser un avis.";
  }

  if (group.payment_status !== "paid") {
    return "La mission groupee doit etre payee avant de laisser un avis.";
  }

  if (children.length !== Number(group.slot_count) || children.length < 2) {
    return "Les creneaux de cette mission sont incomplets.";
  }

  if (!children.every(childCompleted)) {
    return "Tous les creneaux doivent etre confirmes avant de laisser un avis.";
  }

  return null;
}

async function providerInfo(providerId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url")
    .eq("id", providerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Prestataire KLYX introuvable.");

  const targetName =
    data.full_name?.trim() ||
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
    "Prestataire KLYX";

  return {
    targetName,
    avatarUrl: data.avatar_url ?? null,
  };
}

function groupReviewErrorStatus(error: unknown): number {
  const message =
    error instanceof Error
      ? error.message
      : "Impossible de traiter l avis groupe.";
  const baseStatus = apiErrorStatus(message);

  if (baseStatus < 500) return baseStatus;
  if (message === "Mission groupee introuvable.") return 404;
  if (message === "Prestataire KLYX introuvable.") return 404;

  return 500;
}

function secureGroupReviewError(
  error: unknown,
  method: "GET" | "POST",
  event: string,
  code: string,
  startedAt: number
) {
  const message =
    error instanceof Error
      ? error.message
      : "Impossible de traiter l avis groupe.";
  const status = groupReviewErrorStatus(error);

  return secureApiErrorResponse({
    error,
    event,
    route: "/api/group-reviews",
    method,
    status,
    code,
    publicMessage: status < 500 ? message : undefined,
    startedAt,
  });
}

function logGroupReviewSideEffectFailure(
  error: unknown,
  event: string,
  code: string,
  startedAt: number
) {
  logServerError({
    error,
    event,
    route: "/api/group-reviews",
    method: "POST",
    status: 500,
    code,
    durationMs: Math.max(0, Date.now() - startedAt),
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const url = new URL(request.url);
    const groupId = url.searchParams.get("groupId")?.trim() ?? "";

    if (!groupId) {
      return NextResponse.json(
        { error: "Mission groupee manquante." },
        { status: 400 }
      );
    }

    const { group, children } = await loadContext(groupId, profile.id);
    const problem = verifyCompletedGroup(group, children);

    if (problem) {
      return NextResponse.json({ error: problem }, { status: 409 });
    }

    const [provider, reviewResult] = await Promise.all([
      providerInfo(group.provider_profile_id),
      supabaseAdmin
        .from("reviews")
        .select(
          "id, booking_id, booking_group_id, author_id, target_id, rating, comment"
        )
        .eq("booking_group_id", group.id)
        .eq("author_id", profile.id)
        .maybeSingle(),
    ]);

    if (reviewResult.error) throw reviewResult.error;

    const review = reviewResult.data;

    return NextResponse.json({
      groupId: group.id,
      providerId: group.provider_profile_id,
      targetName: provider.targetName,
      avatarUrl: provider.avatarUrl,
      slotCount: children.length,
      totalAmountCents: Number(group.total_amount_cents),
      review: review
        ? {
            id: review.id,
            rating: Number(review.rating),
            comment: review.comment ?? "",
          }
        : null,
    });
  } catch (error) {
    return secureGroupReviewError(
      error,
      "GET",
      "group_review_load_failed",
      "KLYX_GROUP_REVIEW_LOAD_FAILED",
      startedAt
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    let body: {
      groupId?: string;
      rating?: number;
      comment?: string;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Requete invalide." },
        { status: 400 }
      );
    }

    const groupId = body.groupId?.trim() ?? "";
    const rating = Number(body.rating);
    const comment = body.comment?.trim().slice(0, 1000) || null;

    if (!groupId) {
      return NextResponse.json(
        { error: "Mission groupee manquante." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "La note doit etre comprise entre 1 et 5." },
        { status: 400 }
      );
    }

    const { group, children } = await loadContext(groupId, profile.id);
    const problem = verifyCompletedGroup(group, children);

    if (problem) {
      return NextResponse.json({ error: problem }, { status: 409 });
    }

    const canonicalBooking = children[0];

    if (!canonicalBooking) {
      throw new Error("Reservation principale introuvable.");
    }

    const providerId = group.provider_profile_id;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("booking_group_id", group.id)
      .eq("author_id", profile.id)
      .maybeSingle();

    if (existingError) throw existingError;

    let review: ReviewRow;

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .update({
          booking_id: canonicalBooking.id,
          booking_group_id: group.id,
          target_id: providerId,
          rating,
          comment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("author_id", profile.id)
        .select(
          "id, booking_id, booking_group_id, author_id, target_id, rating, comment"
        )
        .single();

      if (error) throw error;
      review = data as ReviewRow;
    } else {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .insert({
          booking_id: canonicalBooking.id,
          booking_group_id: group.id,
          author_id: profile.id,
          target_id: providerId,
          rating,
          comment,
        })
        .select(
          "id, booking_id, booking_group_id, author_id, target_id, rating, comment"
        )
        .single();

      if (error) throw error;
      review = data as ReviewRow;
    }

    const { error: notificationError } = await supabaseAdmin
      .from("user_notifications")
      .upsert(
        {
          user_id: providerId,
          booking_id: canonicalBooking.id,
          market_request_id: group.market_request_id,
          type: "system",
          title: "Nouvel avis groupe recu",
          message:
            "Le client a evalue la mission complete de " +
            String(children.length) +
            " creneaux : " +
            String(rating) +
            "/5.",
          href: "/providers/" + providerId,
          deduplication_key:
            "booking-group:" + group.id + ":review-provider",
        },
        {
          onConflict: "deduplication_key",
          ignoreDuplicates: true,
        }
      );

    if (notificationError) {
      logGroupReviewSideEffectFailure(
        notificationError,
        "group_review_notification_failed",
        "KLYX_GROUP_REVIEW_NOTIFICATION_FAILED",
        startedAt
      );
    }

    if (!existing) {
      after(async () => {
        await sendKlyxDeduplicatedEmail({
          deduplicationKey: `review:${review.id}:received:provider`,
          templateKey: "review.received.provider",
          profileId: providerId,
          ...reviewReceivedEmail(),
        });
      });
    }

    try {
      await recalculateProviderScores(providerId);
    } catch (scoreError) {
      logGroupReviewSideEffectFailure(
        scoreError,
        "group_review_score_recalculation_failed",
        "KLYX_GROUP_REVIEW_SCORE_RECALCULATION_FAILED",
        startedAt
      );
    }

    return NextResponse.json({
      groupId: group.id,
      providerId,
      review: {
        id: review.id,
        rating: Number(review.rating),
        comment: review.comment ?? "",
      },
      message: existing ? "Avis groupe modifie." : "Avis groupe publie.",
    });
  } catch (error) {
    return secureGroupReviewError(
      error,
      "POST",
      "group_review_save_failed",
      "KLYX_GROUP_REVIEW_SAVE_FAILED",
      startedAt
    );
  }
}
