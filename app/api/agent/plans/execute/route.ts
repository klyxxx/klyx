import { NextResponse } from "next/server";

import { GET as providerSearchCore } from "@/app/api/search/providers/providers-route-core";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import type { AgentStep } from "@/lib/client-agent";
import type {
  ProviderSearchItem,
  ProviderSearchResponse,
} from "@/lib/provider-search";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/agent/plans/execute";

type PlanRow = {
  id: string;
  profile_id: string;
  title: string;
  raw_request: string;
  service_slug: string | null;
  city: string | null;
  requested_day: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  budget_max: number | null;
  plan_status: string;
  steps: AgentStep[] | null;
  memory_used: boolean;
  execution_status: string;
  execution_revision: number;
  selected_provider_id: string | null;
  selected_user_service_id: string | null;
  search_snapshot: unknown;
  next_action: string | null;
  next_action_href: string | null;
  last_execution_code: string | null;
  last_execution_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type ClaimRow = {
  action: "execute" | "reuse" | "busy" | "closed";
  revision: number;
};

function planSelect() {
  return "id, profile_id, title, raw_request, service_slug, city, requested_day, requested_time, duration_hours, budget_max, plan_status, steps, memory_used, execution_status, execution_revision, selected_provider_id, selected_user_service_id, search_snapshot, next_action, next_action_href, last_execution_code, last_execution_at, created_at, updated_at, completed_at";
}

function safeExecutionError(error: unknown, startedAt: number) {
  const message =
    error instanceof Error
      ? error.message
      : "Exécution du plan impossible.";
  const status = apiErrorStatus(message);

  return secureApiErrorResponse({
    error,
    event: "agent_plan_execution_failed",
    route: ROUTE,
    method: "POST",
    status,
    code: "KLYX_AGENT_PLAN_EXECUTION_FAILED",
    publicMessage: status < 500 ? message : undefined,
    startedAt,
  });
}

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

function searchRequest(plan: PlanRow): Request {
  const params = new URLSearchParams({
    service: plan.service_slug ?? "",
    city: plan.city ?? "",
    date: plan.requested_day ?? "",
    time: (plan.requested_time ?? "").slice(0, 5),
    duration: String(plan.duration_hours ?? 1),
    sort: "recommended",
  });

  if (plan.budget_max != null) {
    params.set("budget", String(plan.budget_max));
  }

  return new Request(
    `http://klyx.local/api/search/providers?${params.toString()}`,
    { method: "GET" }
  );
}

function bookingHref(plan: PlanRow, provider: ProviderSearchItem): string {
  const params = new URLSearchParams({
    service: provider.serviceSlug,
    agentPlan: plan.id,
  });

  if (plan.requested_day) params.set("date", plan.requested_day);
  if (plan.requested_time) {
    params.set("start", plan.requested_time.slice(0, 5));
    const end = endTime(plan.requested_time, plan.duration_hours);
    if (end) params.set("end", end);
  }

  return `/providers/${provider.profileId}/book?${params.toString()}`;
}

function publicSnapshot(provider: ProviderSearchItem) {
  return {
    profileId: provider.profileId,
    userServiceId: provider.userServiceId,
    serviceSlug: provider.serviceSlug,
    serviceLabel: provider.serviceLabel,
    firstName: provider.firstName,
    businessName: provider.businessName,
    title: provider.title,
    pricingType: provider.pricingType,
    price: provider.price,
    city: provider.city,
    klyxScore: provider.klyxScore,
    rating: provider.rating,
    reviewCount: provider.reviewCount,
    isVerified: provider.isVerified,
    isExactMatch: provider.isExactMatch,
    availabilitySummary: provider.availabilitySummary,
  };
}

async function writeEvent(params: {
  planId: string;
  profileId: string;
  revision: number;
  eventType:
    | "search_started"
    | "search_succeeded"
    | "provider_selected"
    | "confirmation_required"
    | "execution_failed";
  stepId: "search" | "choose" | "book" | "pay" | null;
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

async function loadPlan(planId: string, profileId: string): Promise<PlanRow | null> {
  const { data, error } = await supabaseAdmin
    .from("client_agent_plans")
    .select(planSelect())
    .eq("id", planId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as PlanRow | null) ?? null;
}

function responsePlan(plan: PlanRow) {
  return {
    id: plan.id,
    title: plan.title,
    raw_request: plan.raw_request,
    service_slug: plan.service_slug,
    city: plan.city,
    requested_day: plan.requested_day,
    requested_time: plan.requested_time,
    duration_hours: plan.duration_hours,
    budget_max: plan.budget_max,
    plan_status: plan.plan_status,
    steps: normalizeSteps(plan.steps),
    memory_used: plan.memory_used,
    execution_status: plan.execution_status,
    execution_revision: plan.execution_revision,
    selected_provider_id: plan.selected_provider_id,
    selected_user_service_id: plan.selected_user_service_id,
    search_snapshot: plan.search_snapshot,
    next_action: plan.next_action,
    next_action_href: plan.next_action_href,
    last_execution_code: plan.last_execution_code,
    last_execution_at: plan.last_execution_at,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    completed_at: plan.completed_at,
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let claimedPlanId = "";
  let claimedProfileId = "";
  let claimedRevision = 0;

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as { planId?: unknown };
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";

    if (!planId) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }

    const initialPlan = await loadPlan(planId, profile.id);
    if (!initialPlan) {
      return NextResponse.json({ error: "Plan introuvable." }, { status: 404 });
    }

    const missing = [
      initialPlan.service_slug ? null : "service",
      initialPlan.city ? null : "ville",
      initialPlan.requested_day ? null : "date",
      initialPlan.requested_time ? null : "heure",
    ].filter((value): value is string => Boolean(value));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Complète d’abord : ${missing.join(", ")}.`,
          requiresConfirmation: "complete",
        },
        { status: 409 }
      );
    }

    const { data: claimData, error: claimError } = await supabaseAdmin.rpc(
      "klyx_claim_client_agent_execution",
      {
        p_plan_id: planId,
        p_profile_id: profile.id,
      }
    );

    if (claimError) throw claimError;

    const claim = (Array.isArray(claimData) ? claimData[0] : null) as
      | ClaimRow
      | undefined;

    if (!claim) throw new Error("KLYX_AGENT_EXECUTION_CLAIM_FAILED");

    if (claim.action === "closed") {
      return NextResponse.json(
        { error: "Ce plan est déjà fermé." },
        { status: 409 }
      );
    }

    if (claim.action === "busy") {
      return NextResponse.json(
        {
          error: "KLYX exécute déjà ce plan.",
          retryAfter: 5,
        },
        {
          status: 409,
          headers: { "Retry-After": "5" },
        }
      );
    }

    if (claim.action === "reuse") {
      const persisted = await loadPlan(planId, profile.id);
      if (!persisted) throw new Error("KLYX_AGENT_PLAN_NOT_FOUND");

      return NextResponse.json({
        reused: true,
        requiresConfirmation: persisted.next_action,
        plan: responsePlan(persisted),
      });
    }

    claimedPlanId = planId;
    claimedProfileId = profile.id;
    claimedRevision = Number(claim.revision);

    await writeEvent({
      planId,
      profileId: profile.id,
      revision: claimedRevision,
      eventType: "search_started",
      stepId: "search",
      payload: {
        serviceSlug: initialPlan.service_slug,
        city: initialPlan.city,
      },
    });

    const searchResponse = await providerSearchCore(searchRequest(initialPlan));
    const searchPayload = (await searchResponse.json()) as ProviderSearchResponse & {
      error?: string;
    };

    if (!searchResponse.ok) {
      throw new Error("KLYX_AGENT_PROVIDER_SEARCH_FAILED");
    }

    const providers = Array.isArray(searchPayload.providers)
      ? searchPayload.providers
      : [];
    const snapshot = providers.slice(0, 5).map(publicSnapshot);
    let nextSteps = setStep(normalizeSteps(initialPlan.steps), "search", {
      status: "completed",
      actionHref: null,
      requiresConfirmation: false,
      description: `${searchPayload.exactCount} correspondance${
        searchPayload.exactCount > 1 ? "s" : ""
      } exacte${searchPayload.exactCount > 1 ? "s" : ""} trouvée${
        searchPayload.exactCount > 1 ? "s" : ""
      } par KLYX.`,
    });

    await writeEvent({
      planId,
      profileId: profile.id,
      revision: claimedRevision,
      eventType: "search_succeeded",
      stepId: "search",
      payload: {
        exactCount: searchPayload.exactCount,
        totalCandidates: searchPayload.totalCandidates,
        showingAlternatives: searchPayload.showingAlternatives,
      },
    });

    const selected =
      searchPayload.exactCount > 0
        ? providers.find((provider) => provider.isExactMatch) ?? providers[0]
        : null;

    if (!selected) {
      nextSteps = setStep(nextSteps, "choose", {
        status: "ready",
        actionHref: initialPlan.service_slug
          ? `/search?${new URL(searchRequest(initialPlan).url).searchParams.toString()}`
          : null,
        requiresConfirmation: true,
        description:
          "Aucun match exact n’est disponible. KLYX te laisse choisir parmi les alternatives au lieu d’engager un prestataire approximatif.",
      });

      const now = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("client_agent_plans")
        .update({
          plan_status: "in_progress",
          steps: nextSteps,
          search_snapshot: snapshot,
          execution_status: "waiting_confirmation",
          next_action: "choose",
          next_action_href:
            nextSteps.find((step) => step.id === "choose")?.actionHref ?? null,
          last_execution_code: "KLYX_AGENT_EXACT_PROVIDER_REQUIRED",
          last_execution_at: now,
          updated_at: now,
        })
        .eq("id", planId)
        .eq("profile_id", profile.id)
        .eq("execution_revision", claimedRevision);

      if (updateError) throw updateError;

      await writeEvent({
        planId,
        profileId: profile.id,
        revision: claimedRevision,
        eventType: "confirmation_required",
        stepId: "choose",
        payload: { reason: "no_exact_provider" },
      });

      const persisted = await loadPlan(planId, profile.id);
      if (!persisted) throw new Error("KLYX_AGENT_PLAN_NOT_FOUND");

      return NextResponse.json({
        reused: false,
        requiresConfirmation: "choose",
        plan: responsePlan(persisted),
      });
    }

    const href = bookingHref(initialPlan, selected);
    nextSteps = setStep(nextSteps, "choose", {
      status: "completed",
      actionHref: null,
      requiresConfirmation: false,
      description: `${selected.businessName || selected.firstName || "Prestataire"} est le meilleur match exact recommandé par KLYX.`,
    });
    nextSteps = setStep(nextSteps, "book", {
      status: "ready",
      actionHref: href,
      requiresConfirmation: true,
      description:
        "Le prestataire est choisi. Vérifie les détails puis confirme toi-même la réservation.",
    });

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("client_agent_plans")
      .update({
        plan_status: "in_progress",
        steps: nextSteps,
        selected_provider_id: selected.profileId,
        selected_user_service_id: selected.userServiceId,
        search_snapshot: snapshot,
        execution_status: "waiting_confirmation",
        next_action: "book",
        next_action_href: href,
        last_execution_code: null,
        last_execution_at: now,
        updated_at: now,
      })
      .eq("id", planId)
      .eq("profile_id", profile.id)
      .eq("execution_revision", claimedRevision);

    if (updateError) throw updateError;

    await writeEvent({
      planId,
      profileId: profile.id,
      revision: claimedRevision,
      eventType: "provider_selected",
      stepId: "choose",
      payload: {
        providerId: selected.profileId,
        userServiceId: selected.userServiceId,
        serviceSlug: selected.serviceSlug,
        isExactMatch: selected.isExactMatch,
      },
    });
    await writeEvent({
      planId,
      profileId: profile.id,
      revision: claimedRevision,
      eventType: "confirmation_required",
      stepId: "book",
      payload: { action: "book" },
    });

    const persisted = await loadPlan(planId, profile.id);
    if (!persisted) throw new Error("KLYX_AGENT_PLAN_NOT_FOUND");

    return NextResponse.json({
      reused: false,
      requiresConfirmation: "book",
      plan: responsePlan(persisted),
    });
  } catch (error) {
    if (claimedPlanId && claimedProfileId && claimedRevision > 0) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("client_agent_plans")
        .update({
          execution_status: "failed",
          last_execution_code: "KLYX_AGENT_EXECUTION_FAILED",
          last_execution_at: now,
          updated_at: now,
        })
        .eq("id", claimedPlanId)
        .eq("profile_id", claimedProfileId)
        .eq("execution_revision", claimedRevision);

      await writeEvent({
        planId: claimedPlanId,
        profileId: claimedProfileId,
        revision: claimedRevision,
        eventType: "execution_failed",
        stepId: null,
        payload: { code: "KLYX_AGENT_EXECUTION_FAILED" },
      }).catch(() => undefined);
    }

    return safeExecutionError(error, startedAt);
  }
}
