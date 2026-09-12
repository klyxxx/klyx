import { NextResponse } from "next/server";
import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  TRUST_SAFETY_LEGAL_PATHS,
  TRUST_SAFETY_TRUST_LEVELS,
  TRUST_SAFETY_VERIFICATION_STATES,
  type TrustSafetyLegalPath,
  type TrustSafetyTrustLevel,
  type TrustSafetyVerificationState,
} from "@/lib/trust-safety-authority";
import { sanitizeTrustSafetyCategoryKey } from "@/lib/trust-safety-server";

const REPORT_STATUSES = [
  "open",
  "under_review",
  "waiting_information",
  "resolved",
  "dismissed",
] as const;
const RESTRICTION_ACTIONS = [
  "manual_review_only",
  "category_block",
  "mission_block",
] as const;
const REVIEW_DECISIONS = ["upheld", "modified", "lifted"] as const;

type AdminAction =
  | "review_legal_path"
  | "resolve_report"
  | "impose_restriction"
  | "review_restriction"
  | "set_verification"
  | "set_qualification"
  | "set_trust_level";

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function reasonCode(value: unknown): string {
  const code = text(value, 100).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_:-]{2,99}$/.test(code)) {
    throw new Error("Invalid Trust & Safety reason code");
  }
  return code;
}

async function audit(input: {
  subjectProfileId: string | null;
  adminUserId: string;
  eventType: string;
  objectType: string;
  objectId?: string | null;
  reasons: string[];
  detail?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("trust_safety_audit_events").insert({
    subject_profile_id: input.subjectProfileId,
    actor_admin_user_id: input.adminUserId,
    event_type: input.eventType,
    object_type: input.objectType,
    object_id: input.objectId ?? null,
    reason_codes: input.reasons,
    detail: input.detail ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function GET() {
  const startedAt = Date.now();
  try {
    await requireKlyxAdmin();
    const [reports, restrictions, legalReviews] = await Promise.all([
      supabaseAdmin
        .from("trust_safety_reports")
        .select(
          "id, reporter_profile_id, subject_profile_id, booking_id, category_key, report_type, severity, description, status, requires_human_review, assigned_admin_user_id, resolution_code, resolution_note, created_at, updated_at"
        )
        .in("status", ["open", "under_review", "waiting_information"])
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("trust_safety_restrictions")
        .select(
          "id, profile_id, scope, category_key, action, status, reason_code, explanation, source_report_id, starts_at, ends_at, review_status, review_requested_at, review_request_note, created_at, updated_at"
        )
        .in("status", ["active", "under_review"])
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("trust_safety_profiles")
        .select(
          "profile_id, jurisdiction_country_code, declared_legal_path, declared_activity_frequency, legal_path_review_status, legal_path_reviewed_path, legal_path_reviewed_at, legal_path_review_note, updated_at"
        )
        .neq("declared_legal_path", "unknown")
        .in("legal_path_review_status", ["not_reviewed", "pending", "rejected"])
        .order("updated_at", { ascending: true }),
    ]);

    if (reports.error) throw new Error(reports.error.message);
    if (restrictions.error) throw new Error(restrictions.error.message);
    if (legalReviews.error) throw new Error(legalReviews.error.message);

    return NextResponse.json({
      reports: reports.data ?? [],
      restrictions: restrictions.data ?? [],
      legalPathReviews: legalReviews.data ?? [],
      policy: {
        reportsNeverAutoSuspend: true,
        legalClassificationAutomatic: false,
        sensitiveDecisionsHumanReviewable: true,
      },
    });
  } catch (error) {
    const status = adminErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "admin_trust_safety_read_failed",
      route: "/api/admin/trust-safety",
      method: "GET",
      code: "KLYX_ADMIN_TRUST_SAFETY_READ_FAILED",
      status,
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const admin = await requireKlyxAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 64) as AdminAction;
    const now = new Date().toISOString();

    if (action === "review_legal_path") {
      const profileId = text(body.profileId, 100);
      const reviewedPath = text(body.reviewedPath, 64) as TrustSafetyLegalPath;
      const decision = text(body.decision, 32);
      const note = text(body.note);
      const code = reasonCode(body.reasonCode);
      if (!profileId || !TRUST_SAFETY_LEGAL_PATHS.includes(reviewedPath) || reviewedPath === "unknown") {
        return NextResponse.json({ error: "Invalid legal-path review." }, { status: 400 });
      }
      if (!['approved', 'rejected'].includes(decision) || note.length < 20) {
        return NextResponse.json(
          { error: "A human decision and an explanation of at least 20 characters are required." },
          { status: 400 }
        );
      }

      const { data: current, error: readError } = await supabaseAdmin
        .from("trust_safety_profiles")
        .select("profile_id, declared_legal_path")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!current) return NextResponse.json({ error: "Trust & Safety profile not found." }, { status: 404 });
      if (current.declared_legal_path !== reviewedPath) {
        return NextResponse.json(
          { error: "The reviewed path must match the person’s current declaration." },
          { status: 409 }
        );
      }

      const { error } = await supabaseAdmin
        .from("trust_safety_profiles")
        .update({
          legal_path_review_status: decision,
          legal_path_reviewed_path: reviewedPath,
          legal_path_reviewed_by: admin.id,
          legal_path_reviewed_at: now,
          legal_path_review_note: `${code}: ${note}`,
          updated_at: now,
        })
        .eq("profile_id", profileId)
        .eq("declared_legal_path", reviewedPath);
      if (error) throw new Error(error.message);

      await audit({
        subjectProfileId: profileId,
        adminUserId: admin.id,
        eventType: "legal_path_reviewed",
        objectType: "trust_safety_profile",
        objectId: profileId,
        reasons: [code, "LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC"],
        detail: { reviewedPath, decision, note },
      });
      return NextResponse.json({ message: "Legal pathway review recorded.", decision });
    }

    if (action === "resolve_report") {
      const reportId = text(body.reportId, 100);
      const status = text(body.status, 32);
      const note = text(body.note);
      const code = reasonCode(body.reasonCode);
      if (!reportId || !REPORT_STATUSES.includes(status as (typeof REPORT_STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
      }
      if (["resolved", "dismissed", "waiting_information"].includes(status) && note.length < 20) {
        return NextResponse.json({ error: "A detailed review note is required." }, { status: 400 });
      }
      const { data: report, error: readError } = await supabaseAdmin
        .from("trust_safety_reports")
        .select("id, subject_profile_id")
        .eq("id", reportId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

      const terminal = status === "resolved" || status === "dismissed";
      const { error } = await supabaseAdmin
        .from("trust_safety_reports")
        .update({
          status,
          assigned_admin_user_id: admin.id,
          resolution_code: terminal ? code : null,
          resolution_note: note || null,
          resolved_at: terminal ? now : null,
          updated_at: now,
        })
        .eq("id", report.id);
      if (error) throw new Error(error.message);
      await audit({
        subjectProfileId: report.subject_profile_id,
        adminUserId: admin.id,
        eventType: "report_reviewed",
        objectType: "trust_safety_report",
        objectId: report.id,
        reasons: [code],
        detail: { status, note },
      });
      return NextResponse.json({ message: "Report review recorded.", status });
    }

    if (action === "impose_restriction") {
      const profileId = text(body.profileId, 100);
      const scope = text(body.scope, 32);
      const restrictionAction = text(body.restrictionAction, 64);
      const categoryKey = scope === "category"
        ? sanitizeTrustSafetyCategoryKey(text(body.category, 64))
        : null;
      const code = reasonCode(body.reasonCode);
      const explanation = text(body.explanation);
      const sourceReportId = text(body.sourceReportId, 100) || null;
      const endsAtText = text(body.endsAt, 100);
      const endsAt = endsAtText ? new Date(endsAtText) : null;

      if (!profileId || !["global", "category"].includes(scope)) {
        return NextResponse.json({ error: "Invalid restriction scope." }, { status: 400 });
      }
      if (!RESTRICTION_ACTIONS.includes(restrictionAction as (typeof RESTRICTION_ACTIONS)[number])) {
        return NextResponse.json({ error: "Invalid restriction action." }, { status: 400 });
      }
      if (restrictionAction === "category_block" && scope !== "category") {
        return NextResponse.json({ error: "Category blocks require category scope." }, { status: 400 });
      }
      if (explanation.length < 20) {
        return NextResponse.json({ error: "A reasoned explanation of at least 20 characters is required." }, { status: 400 });
      }
      if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= Date.now())) {
        return NextResponse.json({ error: "Restriction end time must be in the future." }, { status: 400 });
      }

      const { data: restriction, error } = await supabaseAdmin
        .from("trust_safety_restrictions")
        .insert({
          profile_id: profileId,
          scope,
          category_key: categoryKey,
          action: restrictionAction,
          status: "active",
          reason_code: code,
          explanation,
          source_report_id: sourceReportId,
          imposed_by_admin_user_id: admin.id,
          starts_at: now,
          ends_at: endsAt ? endsAt.toISOString() : null,
          review_status: "not_requested",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await audit({
        subjectProfileId: profileId,
        adminUserId: admin.id,
        eventType: "restriction_imposed",
        objectType: "trust_safety_restriction",
        objectId: restriction.id,
        reasons: [code],
        detail: { scope, categoryKey, restrictionAction, explanation, sourceReportId, endsAt: endsAt?.toISOString() ?? null },
      });
      return NextResponse.json({
        restrictionId: restriction.id,
        reviewable: true,
        message: "Restriction recorded with an explicit reason and human review path.",
      });
    }

    if (action === "review_restriction") {
      const restrictionId = text(body.restrictionId, 100);
      const decision = text(body.decision, 32);
      const note = text(body.note);
      const code = reasonCode(body.reasonCode);
      if (!restrictionId || !REVIEW_DECISIONS.includes(decision as (typeof REVIEW_DECISIONS)[number]) || note.length < 20) {
        return NextResponse.json({ error: "Invalid restriction review." }, { status: 400 });
      }
      const { data: restriction, error: readError } = await supabaseAdmin
        .from("trust_safety_restrictions")
        .select("id, profile_id")
        .eq("id", restrictionId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!restriction) return NextResponse.json({ error: "Restriction not found." }, { status: 404 });

      const { error } = await supabaseAdmin
        .from("trust_safety_restrictions")
        .update({
          status: decision === "lifted" ? "lifted" : "active",
          review_status: decision,
          reviewed_by_admin_user_id: admin.id,
          reviewed_at: now,
          review_note: `${code}: ${note}`,
          updated_at: now,
        })
        .eq("id", restriction.id);
      if (error) throw new Error(error.message);
      await audit({
        subjectProfileId: restriction.profile_id,
        adminUserId: admin.id,
        eventType: "restriction_reviewed",
        objectType: "trust_safety_restriction",
        objectId: restriction.id,
        reasons: [code],
        detail: { decision, note },
      });
      return NextResponse.json({ message: "Restriction review recorded.", decision });
    }

    if (action === "set_verification") {
      const profileId = text(body.profileId, 100);
      const verificationKey = text(body.verificationKey, 100);
      const status = text(body.status, 32) as TrustSafetyVerificationState;
      const note = text(body.note);
      const code = reasonCode(body.reasonCode);
      if (!profileId || !verificationKey || !TRUST_SAFETY_VERIFICATION_STATES.includes(status) || note.length < 20) {
        return NextResponse.json({ error: "Invalid verification review." }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from("trust_safety_verifications").upsert(
        {
          profile_id: profileId,
          verification_key: verificationKey,
          status,
          source: "klyx_admin_review",
          reviewed_by_admin_user_id: admin.id,
          reviewed_at: now,
          review_note: `${code}: ${note}`,
          updated_at: now,
        },
        { onConflict: "profile_id,verification_key" }
      );
      if (error) throw new Error(error.message);
      await audit({
        subjectProfileId: profileId,
        adminUserId: admin.id,
        eventType: "verification_reviewed",
        objectType: "trust_safety_verification",
        reasons: [code],
        detail: { verificationKey, status, note },
      });
      return NextResponse.json({ message: "Verification state recorded.", status });
    }

    if (action === "set_qualification") {
      const profileId = text(body.profileId, 100);
      const qualificationKey = text(body.qualificationKey, 100);
      const categoryKey = sanitizeTrustSafetyCategoryKey(text(body.category, 64) || "*");
      const status = text(body.status, 32) as TrustSafetyVerificationState;
      const note = text(body.note);
      const code = reasonCode(body.reasonCode);
      if (!profileId || !qualificationKey || !TRUST_SAFETY_VERIFICATION_STATES.includes(status) || note.length < 20) {
        return NextResponse.json({ error: "Invalid qualification review." }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from("trust_safety_qualifications").upsert(
        {
          profile_id: profileId,
          category_key: categoryKey,
          qualification_key: qualificationKey,
          status,
          reviewed_by_admin_user_id: admin.id,
          reviewed_at: now,
          review_note: `${code}: ${note}`,
          updated_at: now,
        },
        { onConflict: "profile_id,category_key,qualification_key" }
      );
      if (error) throw new Error(error.message);
      await audit({
        subjectProfileId: profileId,
        adminUserId: admin.id,
        eventType: "qualification_reviewed",
        objectType: "trust_safety_qualification",
        reasons: [code],
        detail: { qualificationKey, categoryKey, status, note },
      });
      return NextResponse.json({ message: "Qualification state recorded.", status });
    }

    if (action === "set_trust_level") {
      const profileId = text(body.profileId, 100);
      const trustLevel = text(body.trustLevel, 32) as TrustSafetyTrustLevel;
      const note = text(body.note);
      const code = reasonCode(body.reasonCode);
      if (!profileId || !TRUST_SAFETY_TRUST_LEVELS.includes(trustLevel) || note.length < 20) {
        return NextResponse.json({ error: "Invalid trust-level decision." }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from("trust_safety_profiles").upsert(
        {
          profile_id: profileId,
          trust_level: trustLevel,
          updated_at: now,
        },
        { onConflict: "profile_id" }
      );
      if (error) throw new Error(error.message);
      await audit({
        subjectProfileId: profileId,
        adminUserId: admin.id,
        eventType: "trust_level_changed",
        objectType: "trust_safety_profile",
        objectId: profileId,
        reasons: [code],
        detail: { trustLevel, note },
      });
      return NextResponse.json({ message: "Trust level recorded.", trustLevel });
    }

    return NextResponse.json({ error: "Unsupported Trust & Safety action." }, { status: 400 });
  } catch (error) {
    const status = adminErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "admin_trust_safety_write_failed",
      route: "/api/admin/trust-safety",
      method: "POST",
      code: "KLYX_ADMIN_TRUST_SAFETY_WRITE_FAILED",
      status,
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}
