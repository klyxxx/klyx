import { NextResponse } from "next/server";

import { POST as createBookingCore } from "@/app/api/bookings/create/route";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import type { AgentStep } from "@/lib/client-agent";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/agent/plans/confirm-booking";

type PlanRow = {
  id: string;
  profile_id: string;
  raw_request: string;
  service_slug: string | null;
  requested_day: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  plan_status: string;
  steps: AgentStep[] | null;
  execution_status: string;
  execution_revision: number;
  selected_provider_id: string | null;
  selected_user_service_id: string | null;
  next_action: string | null;
  booking_id: string | null;
  created_at: string;
};

type BookingClaimRow = {
  action: "create" | "reuse" | "busy" | "closed" | "invalid";
  revision: number;
  booking_id: string | null;
};

function normalizeSteps(value: AgentStep[] | null): AgentStep[] {
  return Array.isArray(value) ? value : [];
}

function setStep(
  steps: AgentStep[],
  stepId: AgentStep["id"],
  patch: Partial<AgentStep>
): AgentStep[] {
  return steps.map((step) =>
    step.id === stepId ? { ...step, ...patch } : step
  );
}

function endTime(startTime: string, durationHours: number | null): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime.slice(0, 5));
  if (!match) return null;

  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const durationMinutes = Math.max(1, Math.round((durationHours ?? 1) * 60));
  const total = startMinutes + durationMinutes;

  if (total > 23 * 60 + 59) return null;

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

async function loadPlan(planId: string, profileId: string): Promise<PlanRow | null> {
  const { data, error } = await supabaseAdmin
    .from("client_agent_plans")
    .select(
      "id, profile_id, raw_request, service_slug, requested_day, requested_time, duration_hours, plan_status, steps, execution_status, execution_revision, selected_provider_id, selected_user_service_id, next_action, booking_id, created_at"
    )
    .eq("id", planId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as PlanRow | null) ?? null;
}

async function writeEvent(params: {
  planId: string;
  profileId: string;
  revision: number;
  eventType:
    | "booking_confirmation_granted"
    | "booking_created"
    | "execution_failed";
  stepId: "book" | null;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin
    .from("client_agent_plan_events")
    .upsert(
      {
        plan_id: params.planId,
        profile_id: params.profileId,
        execution_revision: params.revision,
        event_type: params.eventType,
        step_id: params.stepId,
        payload: params.payload ?? {},
      },
      {
        onConflict: "plan_id,execution_revision,event_type",
        ignoreDuplicates: true,
      }
    );

  if (error) throw error;
}

async function recoverBooking(plan: PlanRow, profileId: string) {
  if (
    !plan.selected_provider_id ||
    !plan.selected_user_service_id ||
    !plan.requested_day ||
    !plan.requested_time
  ) {
    return null;
  }

  const end = endTime(plan.requested_time, plan.duration_hours);
  if (!end) return null;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, created_at")
    .eq("parent_id", profileId)
    .eq("provider_id", plan.selected_provider_id)
    .eq("user_service_id", plan.selected_user_service_id)
    .eq("booking_date", plan.requested_day)
    .eq("start_time", plan.requested_time.slice(0, 5))
    .eq("end_time", end)
    .gte("created_at", plan.created_at)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

function bookingRequest(request: Request, plan: PlanRow): Request {
  if (
    !plan.selected_provider_id ||
    !plan.service_slug ||
    !plan.requested_day ||
    !plan.requested_time
  ) {
    throw new Error("KLYX_AGENT_BOOKING_PLAN_INCOMPLETE");
  }

  const end = endTime(plan.requested_time, plan.duration_hours);
  if (!end) throw new Error("KLYX_AGENT_BOOKING_TIME_INVALID");

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");
  if (authorization) headers.set("Authorization", authorization);
  if (cookie) headers.set("Cookie", cookie);
  headers.set("Content-Type", "application/json");

  return new Request("http://klyx.local/api/bookings/create", {
    method: "POST",
    headers,
    body: JSON.stringify({
      providerId: plan.selected_provider_id,
      serviceSlug: plan.service_slug,
      bookingDate: plan.requested_day,
      startTime: plan.requested_time.slice(0, 5),
      endTime: end,
      message: "Réservation confirmée via l’agent KLYX.",
    }),
  });
}

function safeError(error: unknown, startedAt: number) {
  const message =
    error instanceof Error ? error.message : "Confirmation impossible.";
  const status = apiErrorStatus(message);

  return secureApiErrorResponse({
    error,
    event: "agent_booking_confirmation_failed",
    route: ROUTE,
    method: "POST",
    status,
    code: "KLYX_AGENT_BOOKING_CONFIRMATION_FAILED",
    publicMessage: status < 500 ? message : undefined,
    startedAt,
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let claimedPlan: PlanRow | null = null;
  let claimedRevision = 0;

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as { planId?: unknown };
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";

    if (!planId) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }

    const plan = await loadPlan(planId, profile.id);
    if (!plan) {
      return NextResponse.json({ error: "Plan introuvable." }, { status: 404 });
    }

    const { data: claimData, error: claimError } = await supabaseAdmin.rpc(
      "klyx_claim_client_agent_booking_confirmation",
      {
        p_plan_id: planId,
        p_profile_id: profile.id,
      }
    );
    if (claimError) throw claimError;

    const claim = (Array.isArray(claimData) ? claimData[0] : null) as
      | BookingClaimRow
      | undefined;
    if (!claim) throw new Error("KLYX_AGENT_BOOKING_CLAIM_FAILED");

    if (claim.action === "closed") {
      return NextResponse.json({ error: "Ce plan est déjà fermé." }, { status: 409 });
    }
    if (claim.action === "invalid") {
      return NextResponse.json(
        { error: "Ce plan n’est pas prêt à réserver." },
        { status: 409 }
      );
    }
    if (claim.action === "busy") {
      return NextResponse.json(
        { error: "KLYX traite déjà cette confirmation.", retryAfter: 5 },
        { status: 409, headers: { "Retry-After": "5" } }
      );
    }

    if (claim.action === "reuse" && claim.booking_id) {
      return NextResponse.json({
        reused: true,
        bookingId: claim.booking_id,
        requiresConfirmation: "pay",
        href: `/bookings/${claim.booking_id}`,
      });
    }

    claimedPlan = plan;
    claimedRevision = Number(claim.revision);

    await writeEvent({
      planId,
      profileId: profile.id,
      revision: claimedRevision,
      eventType: "booking_confirmation_granted",
      stepId: "book",
      payload: { explicitClientConfirmation: true },
    });

    const createResponse = await createBookingCore(bookingRequest(request, plan));
    const createPayload = (await createResponse.json()) as {
      bookingId?: string;
      error?: string;
    };

    let bookingId = createResponse.ok ? createPayload.bookingId ?? null : null;

    if (!bookingId && createResponse.status === 409) {
      bookingId = await recoverBooking(plan, profile.id);
    }

    if (!bookingId) {
      const message = createPayload.error || "La réservation n’a pas pu être créée.";
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("client_agent_plans")
        .update({
          execution_status: "failed",
          last_execution_code: "KLYX_AGENT_BOOKING_CREATE_FAILED",
          last_execution_at: now,
          updated_at: now,
        })
        .eq("id", planId)
        .eq("profile_id", profile.id)
        .eq("execution_revision", claimedRevision);

      await writeEvent({
        planId,
        profileId: profile.id,
        revision: claimedRevision,
        eventType: "execution_failed",
        stepId: "book",
        payload: { code: "KLYX_AGENT_BOOKING_CREATE_FAILED" },
      });

      return NextResponse.json({ error: message }, { status: createResponse.status });
    }

    let steps = setStep(normalizeSteps(plan.steps), "book", {
      status: "completed",
      actionHref: `/bookings/${bookingId}`,
      requiresConfirmation: true,
      description: "Tu as confirmé la réservation. La demande a été envoyée au prestataire.",
    });
    steps = setStep(steps, "pay", {
      status: "ready",
      actionHref: `/bookings/${bookingId}`,
      requiresConfirmation: true,
      description:
        "Le paiement reste séparé et nécessite ton action explicite après acceptation du prestataire.",
    });

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("client_agent_plans")
      .update({
        booking_id: bookingId,
        plan_status: "in_progress",
        steps,
        execution_status: "waiting_confirmation",
        next_action: "pay",
        next_action_href: `/bookings/${bookingId}`,
        last_execution_code: null,
        last_execution_at: now,
        updated_at: now,
      })
      .eq("id", planId)
      .eq("profile_id", profile.id)
      .eq("execution_revision", claimedRevision);
    if (updateError) throw updateError;

    const { error: linkError } = await supabaseAdmin
      .from("bookings")
      .update({ agent_plan_id: planId, updated_at: now })
      .eq("id", bookingId)
      .eq("parent_id", profile.id);
    if (linkError) throw linkError;

    await writeEvent({
      planId,
      profileId: profile.id,
      revision: claimedRevision,
      eventType: "booking_created",
      stepId: "book",
      payload: { bookingId },
    });

    return NextResponse.json({
      reused: false,
      bookingId,
      requiresConfirmation: "pay",
      href: `/bookings/${bookingId}`,
    });
  } catch (error) {
    if (claimedPlan && claimedRevision > 0) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("client_agent_plans")
        .update({
          execution_status: "failed",
          last_execution_code: "KLYX_AGENT_BOOKING_CONFIRMATION_FAILED",
          last_execution_at: now,
          updated_at: now,
        })
        .eq("id", claimedPlan.id)
        .eq("profile_id", claimedPlan.profile_id)
        .eq("execution_revision", claimedRevision);

      await writeEvent({
        planId: claimedPlan.id,
        profileId: claimedPlan.profile_id,
        revision: claimedRevision,
        eventType: "execution_failed",
        stepId: "book",
        payload: { code: "KLYX_AGENT_BOOKING_CONFIRMATION_FAILED" },
      }).catch(() => undefined);
    }

    return safeError(error, startedAt);
  }
}
