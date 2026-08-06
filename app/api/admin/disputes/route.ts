import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";

type DisputeStatus =
  | "open"
  | "under_review"
  | "waiting_user"
  | "resolved"
  | "closed";

type DecisionCode =
  | "no_action"
  | "warning_recorded"
  | "refund_review_required"
  | "provider_compensation_review"
  | "more_information_required"
  | "safety_escalation";

const STATUSES: DisputeStatus[] = [
  "open",
  "under_review",
  "waiting_user",
  "resolved",
  "closed",
];

const DECISIONS: DecisionCode[] = [
  "no_action",
  "warning_recorded",
  "refund_review_required",
  "provider_compensation_review",
  "more_information_required",
  "safety_escalation",
];

function notificationFor(
  status: DisputeStatus,
  note: string
): {
  title: string;
  message: string;
} {
  if (status === "under_review") {
    return {
      title: "Litige en cours d’analyse",
      message:
        note ||
        "KLYX examine maintenant les informations du dossier.",
    };
  }

  if (status === "waiting_user") {
    return {
      title: "Informations demandées",
      message:
        note ||
        "KLYX attend des informations complémentaires pour ce litige.",
    };
  }

  if (status === "resolved") {
    return {
      title: "Litige résolu",
      message:
        note ||
        "Une décision a été enregistrée pour ce litige.",
    };
  }

  if (status === "closed") {
    return {
      title: "Litige fermé",
      message:
        note ||
        "Le dossier de litige a été fermé.",
    };
  }

  return {
    title: "Litige rouvert",
    message:
      note ||
      "Le dossier est de nouveau ouvert.",
  };
}

export async function GET() {
  try {
    await requireKlyxAdmin();

    const { data: disputes, error } = await supabaseAdmin
      .from("disputes")
      .select(
        "id, booking_id, opened_by, against_profile_id, reason, description, status, priority, resolution, resolved_at, assigned_admin_user_id, decision_code, decision_note, last_reviewed_at, created_at, updated_at"
      )
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const bookingIds = [
      ...new Set(
        (disputes ?? []).map((dispute) => dispute.booking_id)
      ),
    ];

    const profileIds = [
      ...new Set(
        (disputes ?? [])
          .flatMap((dispute) => [
            dispute.opened_by,
            dispute.against_profile_id,
          ])
          .filter(Boolean)
      ),
    ] as string[];

    const [bookingsResult, profilesResult] =
      await Promise.all([
        bookingIds.length
          ? supabaseAdmin
              .from("bookings")
              .select(
                "id, booking_date, start_time, end_time, status, payment_status, amount_total, currency"
              )
              .in("id", bookingIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabaseAdmin
              .from("profiles")
              .select(
                "id, first_name, last_name, account_type"
              )
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (bookingsResult.error) {
      throw new Error(bookingsResult.error.message);
    }

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }

    const bookings = new Map(
      (bookingsResult.data ?? []).map((booking) => [
        booking.id,
        booking,
      ])
    );

    const profiles = new Map(
      (profilesResult.data ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const rows = (disputes ?? []).map((dispute) => ({
      ...dispute,
      booking: bookings.get(dispute.booking_id) ?? null,
      openedByProfile:
        profiles.get(dispute.opened_by) ?? null,
      againstProfile: dispute.against_profile_id
        ? profiles.get(dispute.against_profile_id) ?? null
        : null,
    }));

    return NextResponse.json({ disputes: rows });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les litiges.";

    return NextResponse.json(
      { error: message },
      { status: adminErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireKlyxAdmin();

    const body = (await request.json()) as {
      disputeId?: unknown;
      status?: unknown;
      decisionCode?: unknown;
      note?: unknown;
    };

    const disputeId =
      typeof body.disputeId === "string"
        ? body.disputeId.trim()
        : "";
    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "";
    const decisionCode =
      typeof body.decisionCode === "string"
        ? body.decisionCode.trim()
        : "";
    const note =
      typeof body.note === "string"
        ? body.note.trim().slice(0, 2000)
        : "";

    if (!disputeId) {
      return NextResponse.json(
        { error: "Litige manquant." },
        { status: 400 }
      );
    }

    if (!STATUSES.includes(status as DisputeStatus)) {
      return NextResponse.json(
        { error: "Statut invalide." },
        { status: 400 }
      );
    }

    if (
      decisionCode &&
      !DECISIONS.includes(decisionCode as DecisionCode)
    ) {
      return NextResponse.json(
        { error: "Décision invalide." },
        { status: 400 }
      );
    }

    const selectedStatus = status as DisputeStatus;
    const selectedDecision = decisionCode
      ? (decisionCode as DecisionCode)
      : null;

    if (
      ["waiting_user", "resolved", "closed"].includes(
        selectedStatus
      ) &&
      note.length < 10
    ) {
      return NextResponse.json(
        {
          error:
            "Ajoute une note d’au moins 10 caractères.",
        },
        { status: 400 }
      );
    }

    if (
      ["resolved", "closed"].includes(selectedStatus) &&
      !selectedDecision
    ) {
      return NextResponse.json(
        {
          error:
            "Choisis une décision avant de résoudre ou fermer.",
        },
        { status: 400 }
      );
    }

    const { data: dispute, error: disputeError } =
      await supabaseAdmin
        .from("disputes")
        .select(
          "id, booking_id, opened_by, against_profile_id, status"
        )
        .eq("id", disputeId)
        .maybeSingle();

    if (disputeError) {
      throw new Error(disputeError.message);
    }

    if (!dispute) {
      return NextResponse.json(
        { error: "Litige introuvable." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      status: selectedStatus,
      assigned_admin_user_id: admin.id,
      decision_code: selectedDecision,
      decision_note: note || null,
      last_reviewed_at: now,
      updated_at: now,
    };

    if (selectedStatus === "resolved") {
      updatePayload.resolution =
        note || "Décision enregistrée par KLYX.";
      updatePayload.resolved_at = now;
    } else if (
      selectedStatus === "open" ||
      selectedStatus === "under_review" ||
      selectedStatus === "waiting_user"
    ) {
      updatePayload.resolved_at = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from("disputes")
      .update(updatePayload)
      .eq("id", dispute.id);

    if (updateError) throw new Error(updateError.message);

    const eventType =
      selectedStatus === "resolved"
        ? "resolved"
        : selectedStatus === "closed"
          ? "closed"
          : "status_changed";

    const { error: eventError } = await supabaseAdmin
      .from("dispute_events")
      .insert({
        dispute_id: dispute.id,
        actor_id: null,
        event_type: eventType,
        note:
          `${selectedStatus}` +
          (selectedDecision
            ? ` · ${selectedDecision}`
            : "") +
          (note ? ` · ${note}` : ""),
      });

    if (eventError) {
      throw new Error(eventError.message);
    }

    const notification =
      notificationFor(selectedStatus, note);

    const participantIds = [
      dispute.opened_by,
      dispute.against_profile_id,
    ].filter(Boolean) as string[];

    for (const profileId of [
      ...new Set(participantIds),
    ]) {
      const { error: notificationError } =
        await supabaseAdmin
          .from("user_notifications")
          .insert({
            user_id: profileId,
            booking_id: dispute.booking_id,
            type: "system",
            title: notification.title,
            message: notification.message,
            href:
              profileId === dispute.opened_by
                ? "/trust"
                : "/provider/trust",
            deduplication_key:
              `dispute:${dispute.id}:${selectedStatus}:${now}:${profileId}`,
          });

      if (notificationError) {
        console.error(
          "Dispute notification error:",
          notificationError.message
        );
      }
    }

    return NextResponse.json({
      message: "Le dossier a été mis à jour.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de modifier le litige.";

    return NextResponse.json(
      { error: message },
      { status: adminErrorStatus(error) }
    );
  }
}
