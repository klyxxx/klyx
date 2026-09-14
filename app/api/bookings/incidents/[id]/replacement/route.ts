import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { apiErrorStatus, getAuthenticatedAccount } from "@/lib/api-auth";
import type { AgentStep } from "@/lib/client-agent";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/bookings/incidents/[id]/replacement";

type ReplacementCandidate = {
  profileId: string;
  userServiceId: string;
  serviceSlug: string;
  serviceLabel: string;
  firstName: string;
  businessName: string;
  title: string;
  pricingType: string;
  price: number | null;
  city: string;
  klyxScore: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isExactMatch: boolean;
  availabilitySummary: string;
};

type PlanRow = {
  id: string;
  profile_id: string;
  service_slug: string | null;
  requested_day: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  steps: AgentStep[] | null;
  execution_revision: number;
  search_snapshot: unknown;
};

function candidateName(candidate: ReplacementCandidate): string {
  return candidate.businessName || candidate.firstName || "ce prestataire";
}

function endTime(startTime: string, durationHours: number | null): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime.slice(0, 5));
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const duration = Math.max(1, Math.round((durationHours ?? 1) * 60));
  const total = start + duration;
  if (total > 23 * 60 + 59) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function setStep(
  steps: AgentStep[],
  stepId: AgentStep["id"],
  patch: Partial<AgentStep>
): AgentStep[] {
  return steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step));
}

async function writeIncidentEvent(params: {
  incidentId: string;
  accountId: string;
  authUserId: string;
  eventType: "replacement_presented" | "replacement_selected" | "replacement_declined";
  eventKey: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("booking_incident_events").upsert(
    {
      incident_id: params.incidentId,
      actor_type: "account",
      actor_account_id: params.accountId,
      actor_auth_user_id: params.authUserId,
      event_type: params.eventType,
      event_key: params.eventKey,
      payload: params.payload ?? {},
    },
    { onConflict: "event_key", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();

  try {
    const auth = await getAuthenticatedAccount(request);
    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: unknown;
      providerProfileId?: unknown;
    };
    const action =
      body.action === "present_best" ||
      body.action === "select" ||
      body.action === "decline"
        ? body.action
        : null;

    if (!id || !action) {
      return NextResponse.json({ error: "Incident ou action invalide." }, { status: 400 });
    }

    const { data: incident, error: incidentError } = await supabaseAdmin
      .from("booking_incidents")
      .select(
        "id, booking_id, account_id, status, human_review_required, replacement_plan_id, replacement_candidate_count"
      )
      .eq("id", id)
      .eq("account_id", auth.account.id)
      .maybeSingle();
    if (incidentError) throw new Error(incidentError.message);
    if (!incident) {
      return NextResponse.json({ error: "Incident introuvable." }, { status: 404 });
    }
    if (!incident.replacement_plan_id || incident.replacement_candidate_count <= 0) {
      return NextResponse.json(
        { error: "Aucun remplaçant compatible n’est prêt à être présenté." },
        { status: 409 }
      );
    }

    const { data: planData, error: planError } = await supabaseAdmin
      .from("client_agent_plans")
      .select(
        "id, profile_id, service_slug, requested_day, requested_time, duration_hours, steps, execution_revision, search_snapshot"
      )
      .eq("id", incident.replacement_plan_id)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!planData) {
      return NextResponse.json({ error: "Plan de remplacement introuvable." }, { status: 409 });
    }

    const plan = planData as PlanRow;
    const candidates = Array.isArray(plan.search_snapshot)
      ? (plan.search_snapshot as ReplacementCandidate[]).filter(
          (candidate) => candidate?.isExactMatch === true
        )
      : [];
    if (candidates.length === 0) {
      return NextResponse.json({ error: "Aucun remplaçant exact disponible." }, { status: 409 });
    }

    if (action === "decline") {
      await writeIncidentEvent({
        incidentId: incident.id,
        accountId: auth.account.id,
        authUserId: auth.user.id,
        eventType: "replacement_declined",
        eventKey: `incident:${incident.id}:replacement-declined:${plan.id}`,
        payload: { explicitUserDecision: true },
      });
      await supabaseAdmin
        .from("booking_incidents")
        .update({
          status: incident.human_review_required ? "human_review" : "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", incident.id)
        .eq("account_id", auth.account.id);

      return NextResponse.json({
        message: "Aucun remplaçant n’a été sélectionné.",
        automaticReplacement: false,
        automaticCharge: false,
      });
    }

    if (action === "present_best") {
      const best = candidates[0];
      await writeIncidentEvent({
        incidentId: incident.id,
        accountId: auth.account.id,
        authUserId: auth.user.id,
        eventType: "replacement_presented",
        eventKey: `incident:${incident.id}:replacement-presented:${plan.id}:${best.profileId}`,
        payload: {
          providerProfileId: best.profileId,
          userServiceId: best.userServiceId,
          explicitSelectionStillRequired: true,
        },
      });

      return NextResponse.json({
        assistant: {
          message: `${candidateName(best)} est le meilleur remplaçant exact trouvé par KLYX. Veux-tu le sélectionner ?`,
          requiresConfirmation: "select_replacement",
        },
        candidate: best,
        automaticReplacement: false,
        automaticBooking: false,
        automaticCharge: false,
      });
    }

    const providerProfileId =
      typeof body.providerProfileId === "string"
        ? body.providerProfileId.trim()
        : "";
    const selected = candidates.find(
      (candidate) => candidate.profileId === providerProfileId
    );
    if (!selected) {
      return NextResponse.json(
        { error: "Le remplaçant choisi ne fait pas partie des candidats vérifiés." },
        { status: 400 }
      );
    }
    if (!plan.service_slug || !plan.requested_day || !plan.requested_time) {
      return NextResponse.json({ error: "Plan de remplacement incomplet." }, { status: 409 });
    }

    const end = endTime(plan.requested_time, plan.duration_hours);
    if (!end) {
      return NextResponse.json({ error: "Créneau de remplacement invalide." }, { status: 409 });
    }

    const hrefParams = new URLSearchParams({
      service: plan.service_slug,
      date: plan.requested_day,
      start: plan.requested_time.slice(0, 5),
      end,
      agentPlan: plan.id,
      incident: incident.id,
    });
    const href = `/providers/${selected.profileId}/book?${hrefParams.toString()}`;
    let steps = Array.isArray(plan.steps) ? plan.steps : [];
    steps = setStep(steps, "choose", {
      status: "completed",
      actionHref: null,
      requiresConfirmation: true,
      description: `${candidateName(selected)} a été sélectionné avec ton accord.`,
    });
    steps = setStep(steps, "book", {
      status: "ready",
      actionHref: href,
      requiresConfirmation: true,
      description: "Vérifie la nouvelle réservation puis confirme-la explicitement.",
    });

    const now = new Date().toISOString();
    const { error: updatePlanError } = await supabaseAdmin
      .from("client_agent_plans")
      .update({
        selected_provider_id: selected.profileId,
        selected_user_service_id: selected.userServiceId,
        steps,
        execution_status: "waiting_confirmation",
        next_action: "book",
        next_action_href: href,
        last_execution_code: null,
        last_execution_at: now,
        updated_at: now,
      })
      .eq("id", plan.id);
    if (updatePlanError) throw new Error(updatePlanError.message);

    const { error: agentEventError } = await supabaseAdmin
      .from("client_agent_plan_events")
      .upsert(
        {
          plan_id: plan.id,
          profile_id: plan.profile_id,
          execution_revision: plan.execution_revision,
          event_type: "provider_selected",
          step_id: "choose",
          payload: {
            providerProfileId: selected.profileId,
            userServiceId: selected.userServiceId,
            source: "post_booking_incident",
            incidentId: incident.id,
            explicitUserConsent: true,
          },
        },
        {
          onConflict: "plan_id,execution_revision,event_type",
          ignoreDuplicates: true,
        }
      );
    if (agentEventError) throw new Error(agentEventError.message);

    await writeIncidentEvent({
      incidentId: incident.id,
      accountId: auth.account.id,
      authUserId: auth.user.id,
      eventType: "replacement_selected",
      eventKey: `incident:${incident.id}:replacement-selected:${plan.id}:${selected.profileId}`,
      payload: {
        providerProfileId: selected.profileId,
        userServiceId: selected.userServiceId,
        explicitUserConsent: true,
        bookingCreated: false,
        chargeCreated: false,
      },
    });

    await supabaseAdmin
      .from("booking_incidents")
      .update({ status: "action_required", updated_at: now })
      .eq("id", incident.id)
      .eq("account_id", auth.account.id);

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("unit_price_cents, currency")
      .eq("id", incident.booking_id)
      .maybeSingle();
    const replacementUnitPriceCents =
      selected.price == null ? null : Math.max(0, Math.round(selected.price * 100));

    return NextResponse.json({
      assistant: {
        message: `${candidateName(selected)} est sélectionné. Vérifie le créneau et le prix avant de confirmer la nouvelle réservation.`,
        requiresConfirmation: "book",
      },
      href,
      pricing: {
        currency: booking?.currency ?? null,
        originalUnitPriceCents: booking?.unit_price_cents ?? null,
        replacementUnitPriceCents,
        automaticCharge: false,
      },
      automaticReplacement: false,
      automaticBooking: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "post_booking_replacement_action_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_POST_BOOKING_REPLACEMENT_ACTION_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
