import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  runVerificationPrecheck,
  type VerificationDocumentInput,
} from "@/lib/provider-verification-precheck";
import { logServerError } from "@/lib/server-log";

type ReviewAction =
  | "under_review"
  | "approved"
  | "changes_required"
  | "rejected"
  | "reopened";

const REVIEW_ACTIONS: ReviewAction[] = [
  "under_review",
  "approved",
  "changes_required",
  "rejected",
  "reopened",
];

async function loadDocuments(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("provider_verification_documents")
    .select(
      "id, document_type, original_name, mime_type, size_bytes, status"
    )
    .eq("profile_id", profileId)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []) as VerificationDocumentInput[];
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

    const { data: verifications, error } = await supabaseAdmin
      .from("provider_verifications")
      .select(
        "id, profile_id, status, identity_status, address_status, business_status, insurance_status, professional_status, trust_level, submitted_at, reviewed_at, review_note, updated_at"
      )
      .in("status", [
        "submitted",
        "under_review",
        "changes_required",
        "rejected",
        "approved",
      ])
      .order("submitted_at", {
        ascending: false,
        nullsFirst: false,
      });

    if (error) throw new Error(error.message);

    const rows = await Promise.all(
      (verifications ?? []).map(async (verification) => {
        const documents = await loadDocuments(
          verification.profile_id
        );
        const precheck = runVerificationPrecheck(documents);

        return {
          ...verification,
          documents,
          precheck,
        };
      })
    );

    return NextResponse.json({ verifications: rows });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_verifications_read_failed",
      route: "/api/admin/verifications",
      method: "GET",
      status,
      code: "KLYX_ADMIN_VERIFICATIONS_READ_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const admin = await requireKlyxAdmin();

    const body = (await request.json()) as {
      verificationId?: unknown;
      action?: unknown;
      note?: unknown;
    };

    const verificationId =
      typeof body.verificationId === "string"
        ? body.verificationId.trim()
        : "";
    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";
    const note =
      typeof body.note === "string"
        ? body.note.trim().slice(0, 1000)
        : "";

    if (!verificationId) {
      return NextResponse.json(
        { error: "Dossier manquant." },
        { status: 400 }
      );
    }

    if (!REVIEW_ACTIONS.includes(action as ReviewAction)) {
      return NextResponse.json(
        { error: "Action invalide." },
        { status: 400 }
      );
    }

    if (
      ["changes_required", "rejected"].includes(action) &&
      note.length < 10
    ) {
      return NextResponse.json(
        {
          error:
            "Ajoute une explication d’au moins 10 caractères.",
        },
        { status: 400 }
      );
    }

    const { data: verification, error: verificationError } =
      await supabaseAdmin
        .from("provider_verifications")
        .select("id, profile_id, status")
        .eq("id", verificationId)
        .maybeSingle();

    if (verificationError) {
      throw new Error(verificationError.message);
    }

    if (!verification) {
      return NextResponse.json(
        { error: "Dossier introuvable." },
        { status: 404 }
      );
    }

    const documents = await loadDocuments(
      verification.profile_id
    );
    const precheck = runVerificationPrecheck(documents);
    const selectedAction = action as ReviewAction;
    const now = new Date().toISOString();

    if (
      selectedAction === "approved" &&
      !precheck.passed
    ) {
      return NextResponse.json(
        {
          error:
            "Les contrôles techniques obligatoires ne sont pas réussis.",
        },
        { status: 409 }
      );
    }

    const update: Record<string, unknown> = {
      status:
        selectedAction === "reopened"
          ? "under_review"
          : selectedAction,
      review_note: note || null,
      reviewed_at:
        ["approved", "changes_required", "rejected"].includes(
          selectedAction
        )
          ? now
          : null,
      updated_at: now,
    };

    if (selectedAction === "approved") {
      update.identity_status = "approved";
      update.address_status = "approved";
      update.trust_level = "identity_verified";
    }

    if (selectedAction === "changes_required") {
      update.identity_status = "rejected";
      update.address_status = "rejected";
      update.trust_level = "new";
    }

    if (selectedAction === "rejected") {
      update.identity_status = "rejected";
      update.address_status = "rejected";
      update.trust_level = "new";
    }

    if (
      selectedAction === "under_review" ||
      selectedAction === "reopened"
    ) {
      update.identity_status = "under_review";
      update.address_status = "under_review";
    }

    const { error: updateError } = await supabaseAdmin
      .from("provider_verifications")
      .update(update)
      .eq("id", verification.id);

    if (updateError) throw new Error(updateError.message);

    const { error: reviewError } = await supabaseAdmin
      .from("provider_verification_reviews")
      .insert({
        verification_id: verification.id,
        profile_id: verification.profile_id,
        reviewer_user_id: admin.id,
        action: selectedAction,
        note: note || null,
        automatic_checks: precheck,
      });

    if (reviewError) throw new Error(reviewError.message);

    const title =
      selectedAction === "approved"
        ? "Vérification approuvée"
        : selectedAction === "changes_required"
          ? "Documents à corriger"
          : selectedAction === "rejected"
            ? "Vérification refusée"
            : "Vérification en cours";

    const { error: notificationError } =
      await supabaseAdmin
        .from("user_notifications")
        .insert({
          user_id: verification.profile_id,
          type: "system",
          title,
          message:
            note ||
            "Le statut de ton dossier de vérification a été mis à jour.",
          href: "/provider/verification",
          deduplication_key:
            `verification:${verification.id}:${selectedAction}:${now}`,
        });

    if (notificationError) {
      logServerError({
        error: notificationError,
        event: "admin_verification_notification_failed",
        route: "/api/admin/verifications",
        method: "POST",
        status: 500,
        code: "KLYX_ADMIN_VERIFICATION_NOTIFICATION_FAILED",
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    }

    return NextResponse.json({
      message: "Décision enregistrée.",
      precheck,
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_verification_decision_failed",
      route: "/api/admin/verifications",
      method: "POST",
      status,
      code: "KLYX_ADMIN_VERIFICATION_DECISION_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}
