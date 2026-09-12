import { NextResponse } from "next/server";
import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeTrustSafetyCategoryKey } from "@/lib/trust-safety-server";

const REPORT_TYPES = [
  "safety",
  "fraud",
  "no_show",
  "identity",
  "qualification",
  "harassment",
  "category_violation",
  "other",
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
};

function severityFor(type: ReportType): "normal" | "high" | "urgent" {
  if (type === "safety" || type === "harassment") return "urgent";
  if (type === "fraud" || type === "no_show" || type === "identity") {
    return "high";
  }
  return "normal";
}

async function verifyBookingRelationship(input: {
  bookingId: string;
  reporterProfileId: string;
  subjectProfileId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, parent_id, provider_id, babysitter_id")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Booking not found");

  const booking = data as BookingRow;
  const providerId = booking.provider_id ?? booking.babysitter_id;
  const participants = [booking.parent_id, providerId].filter(
    Boolean
  ) as string[];
  if (
    !participants.includes(input.reporterProfileId) ||
    !participants.includes(input.subjectProfileId) ||
    input.reporterProfileId === input.subjectProfileId
  ) {
    throw new Error("Report participants do not match this booking");
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const { data, error } = await supabaseAdmin
      .from("trust_safety_reports")
      .select(
        "id, subject_profile_id, booking_id, category_key, report_type, severity, description, status, resolution_code, resolution_note, resolved_at, created_at, updated_at"
      )
      .eq("reporter_profile_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load reports.";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "trust_safety_reports_read_failed",
      route: "/api/trust-safety/reports",
      method: "GET",
      code: "KLYX_TRUST_SAFETY_REPORTS_READ_FAILED",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const ratePolicy = API_RATE_LIMIT_POLICIES.trustSafetyReportCreate;
    const rateLimit = await consumeApiRateLimit(profile.id, ratePolicy);
    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(ratePolicy, rateLimit);
    }
    const headers = rateLimitResponseHeaders(ratePolicy, rateLimit);

    const body = (await request.json()) as {
      subjectProfileId?: unknown;
      bookingId?: unknown;
      category?: unknown;
      type?: unknown;
      description?: unknown;
    };

    const subjectProfileId =
      typeof body.subjectProfileId === "string"
        ? body.subjectProfileId.trim()
        : "";
    const bookingId =
      typeof body.bookingId === "string" && body.bookingId.trim()
        ? body.bookingId.trim()
        : null;
    const categoryKey =
      typeof body.category === "string" && body.category.trim()
        ? sanitizeTrustSafetyCategoryKey(body.category)
        : null;
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 4000)
        : "";

    if (!subjectProfileId || subjectProfileId === profile.id) {
      return NextResponse.json(
        { error: "Invalid report subject." },
        { status: 400, headers }
      );
    }
    if (!REPORT_TYPES.includes(type as ReportType)) {
      return NextResponse.json(
        { error: "Invalid report type." },
        { status: 400, headers }
      );
    }
    if (description.length < 20) {
      return NextResponse.json(
        { error: "Describe the issue with at least 20 characters." },
        { status: 400, headers }
      );
    }

    const selectedType = type as ReportType;
    if (selectedType === "no_show" && !bookingId) {
      return NextResponse.json(
        { error: "A no-show report must reference a booking." },
        { status: 400, headers }
      );
    }
    if (bookingId) {
      await verifyBookingRelationship({
        bookingId,
        reporterProfileId: profile.id,
        subjectProfileId,
      });
    }

    const { data: subject, error: subjectError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", subjectProfileId)
      .maybeSingle();
    if (subjectError) throw new Error(subjectError.message);
    if (!subject) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404, headers }
      );
    }

    let duplicateQuery = supabaseAdmin
      .from("trust_safety_reports")
      .select("id")
      .eq("reporter_profile_id", profile.id)
      .eq("subject_profile_id", subjectProfileId)
      .eq("report_type", selectedType)
      .in("status", ["open", "under_review", "waiting_information"]);
    duplicateQuery = bookingId
      ? duplicateQuery.eq("booking_id", bookingId)
      : duplicateQuery.is("booking_id", null);
    const { data: duplicate, error: duplicateError } =
      await duplicateQuery.maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate) {
      return NextResponse.json(
        {
          error: "An active report already exists for this issue.",
          reportId: duplicate.id,
        },
        { status: 409, headers }
      );
    }

    const severity = severityFor(selectedType);
    const { data: report, error: insertError } = await supabaseAdmin
      .from("trust_safety_reports")
      .insert({
        reporter_profile_id: profile.id,
        subject_profile_id: subjectProfileId,
        booking_id: bookingId,
        category_key: categoryKey,
        report_type: selectedType,
        severity,
        description,
        status: "open",
        requires_human_review: true,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    const { error: auditError } = await supabaseAdmin
      .from("trust_safety_audit_events")
      .insert({
        subject_profile_id: subjectProfileId,
        actor_profile_id: profile.id,
        event_type: "report_opened",
        object_type: "trust_safety_report",
        object_id: report.id,
        reason_codes: [`REPORT_${selectedType.toUpperCase()}`],
        detail: { bookingId, categoryKey, severity },
      });
    if (auditError) throw new Error(auditError.message);

    return NextResponse.json(
      {
        reportId: report.id,
        status: "open",
        humanReviewRequired: true,
        automaticSuspension: false,
        message:
          "Report recorded for review. A report alone never creates an automatic suspension.",
      },
      { headers }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create report.";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "trust_safety_report_create_failed",
      route: "/api/trust-safety/reports",
      method: "POST",
      code: "KLYX_TRUST_SAFETY_REPORT_CREATE_FAILED",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
