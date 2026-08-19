import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  buildClientAgentPlan,
  type AgentStep,
} from "@/lib/client-agent";

const STEP_IDS = [
  "understand",
  "complete",
  "search",
  "choose",
  "book",
  "pay",
] as const;

async function loadMemory(profileId: string) {
  const [preferencesResult, profileResult] =
    await Promise.all([
      supabaseAdmin
        .from("user_preferences")
        .select(
          "default_city, default_budget, preferred_service_slugs, scheduling_notes, ai_memory_enabled"
        )
        .eq("user_id", profileId)
        .maybeSingle(),
      supabaseAdmin
        .from("client_memory_profiles")
        .select("memory_enabled")
        .eq("profile_id", profileId)
        .maybeSingle(),
    ]);

  if (preferencesResult.error) {
    throw preferencesResult.error;
  }

  if (
    profileResult.error &&
    profileResult.error.code !== "PGRST116"
  ) {
    throw profileResult.error;
  }

  const preferences = preferencesResult.data;

  return {
    enabled: Boolean(
      preferences?.ai_memory_enabled &&
        (profileResult.data?.memory_enabled ?? true)
    ),
    defaultCity: preferences?.default_city ?? null,
    defaultBudget:
      preferences?.default_budget == null
        ? null
        : Number(preferences.default_budget),
    preferredServiceSlugs:
      preferences?.preferred_service_slugs ?? [],
    preferredTimeText:
      preferences?.scheduling_notes ?? null,
  };
}

function secureAgentPlanError(
  error: unknown,
  method: "GET" | "POST" | "PATCH",
  event: string,
  code: string,
  startedAt: number
) {
  const message =
    error instanceof Error
      ? error.message
      : "Opération agent impossible.";
  const status = apiErrorStatus(message);

  return secureApiErrorResponse({
    error,
    event,
    route: "/api/agent/plans",
    method,
    status,
    code,
    publicMessage: status < 500 ? message : undefined,
    startedAt,
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const { data, error } = await supabaseAdmin
      .from("client_agent_plans")
      .select(
        "id, title, raw_request, service_slug, city, requested_day, requested_time, duration_hours, budget_max, plan_status, steps, memory_used, created_at, updated_at, completed_at"
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      plans: data ?? [],
    });
  } catch (error) {
    return secureAgentPlanError(
      error,
      "GET",
      "agent_plans_load_failed",
      "KLYX_AGENT_PLANS_LOAD_FAILED",
      startedAt
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      request?: unknown;
    };

    const rawRequest =
      typeof body.request === "string"
        ? body.request.trim().slice(0, 2000)
        : "";

    if (rawRequest.length < 3) {
      return NextResponse.json(
        {
          error:
            "Décris ce que KLYX doit organiser.",
        },
        { status: 400 }
      );
    }

    const memory = await loadMemory(profile.id);
    const plan = buildClientAgentPlan({
      request: rawRequest,
      memory,
    });

    const { data, error } = await supabaseAdmin
      .from("client_agent_plans")
      .insert({
        profile_id: profile.id,
        title: plan.title,
        raw_request: rawRequest,
        service_slug: plan.serviceSlug,
        city: plan.city,
        requested_day: plan.requestedDay,
        requested_time: plan.requestedTime,
        duration_hours: plan.durationHours,
        budget_max: plan.budgetMax,
        plan_status: plan.readyForSearch
          ? "ready"
          : "draft",
        steps: plan.steps,
        memory_used: plan.memoryUsed,
      })
      .select(
        "id, title, raw_request, service_slug, city, requested_day, requested_time, duration_hours, budget_max, plan_status, steps, memory_used, created_at, updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      plan: {
        ...data,
        searchHref: plan.searchHref,
        missingFields: plan.missingFields,
      },
    });
  } catch (error) {
    return secureAgentPlanError(
      error,
      "POST",
      "agent_plan_create_failed",
      "KLYX_AGENT_PLAN_CREATE_FAILED",
      startedAt
    );
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      planId?: unknown;
      stepId?: unknown;
      action?: unknown;
    };

    const planId =
      typeof body.planId === "string"
        ? body.planId.trim()
        : "";
    const stepId =
      typeof body.stepId === "string"
        ? body.stepId.trim()
        : "";
    const action =
      body.action === "complete" ||
      body.action === "cancel"
        ? body.action
        : null;

    if (!planId || !action) {
      return NextResponse.json(
        { error: "Action invalide." },
        { status: 400 }
      );
    }

    const { data: plan, error } = await supabaseAdmin
      .from("client_agent_plans")
      .select("id, steps, plan_status")
      .eq("id", planId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) throw error;

    if (!plan) {
      return NextResponse.json(
        { error: "Plan introuvable." },
        { status: 404 }
      );
    }

    if (action === "cancel") {
      const { error: cancelError } = await supabaseAdmin
        .from("client_agent_plans")
        .update({
          plan_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id)
        .eq("profile_id", profile.id);

      if (cancelError) {
        throw cancelError;
      }

      return NextResponse.json({
        message: "Plan annulé.",
      });
    }

    if (
      !STEP_IDS.includes(
        stepId as (typeof STEP_IDS)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Étape invalide." },
        { status: 400 }
      );
    }

    const steps = Array.isArray(plan.steps)
      ? (plan.steps as AgentStep[])
      : [];

    const nextSteps = steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status: "completed" as const,
          }
        : step
    );

    const allCompleted = nextSteps.every(
      (step) => step.status === "completed"
    );

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("client_agent_plans")
      .update({
        steps: nextSteps,
        plan_status: allCompleted
          ? "completed"
          : "in_progress",
        completed_at: allCompleted ? now : null,
        updated_at: now,
      })
      .eq("id", plan.id)
      .eq("profile_id", profile.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      message: "Étape mise à jour.",
      steps: nextSteps,
    });
  } catch (error) {
    return secureAgentPlanError(
      error,
      "PATCH",
      "agent_plan_update_failed",
      "KLYX_AGENT_PLAN_UPDATE_FAILED",
      startedAt
    );
  }
}
