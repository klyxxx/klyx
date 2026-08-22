import { NextResponse } from "next/server";

import { getActiveProfile } from "@/lib/active-profile";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  buildClientMemorySummary,
  canUseClientMemory,
  loadClientMemoryContext,
  recordClientMemoryUsage,
} from "@/lib/client-memory-context";
import {
  generateKlyxAiReply,
  isKlyxAiEnabled,
} from "@/lib/klyx-ai";
import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  message?: unknown;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Non connecté." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    enabled: isKlyxAiEnabled(),
    mode: isKlyxAiEnabled() ? "openai" : "fallback",
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non connecté." },
        { status: 401 }
      );
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide." },
        { status: 400 }
      );
    }

    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { error: "Écris un message." },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Le message est trop long." },
        { status: 400 }
      );
    }

    const profile = await getActiveProfile();
    const policy = API_RATE_LIMIT_POLICIES.aiRespond;
    const rateLimit = await consumeApiRateLimit(
      profile?.id ?? user.id,
      policy
    );

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    let requestedMemorySummary: string[] = [];
    let requestedMemoryFields: string[] = [];

    if (profile?.accountType === "client") {
      const memory = await loadClientMemoryContext(profile.id);

      if (canUseClientMemory(message, memory)) {
        requestedMemorySummary = buildClientMemorySummary(memory);
        requestedMemoryFields = [
          memory.defaultCity ? "default_city" : null,
          memory.defaultBudget != null ? "default_budget" : null,
          memory.preferredServiceSlugs.length > 0
            ? "preferred_service_slugs"
            : null,
          memory.schedulingNotes ? "scheduling_notes" : null,
          memory.childrenCount > 0 ? "children_count" : null,
          memory.petTypes.length > 0 ? "pet_types" : null,
          memory.preferredLanguages.length > 0
            ? "preferred_languages"
            : null,
        ].filter((field): field is string => Boolean(field));
      }
    }

    const reply = await generateKlyxAiReply({
      message,
      firstName: profile?.firstName,
      city: profile?.city,
      accountType: profile?.accountType,
      memorySummary: requestedMemorySummary,
    });
    const memoryUsed =
      reply.mode === "openai" && requestedMemorySummary.length > 0;

    if (memoryUsed && profile?.accountType === "client") {
      await recordClientMemoryUsage({
        profileId: profile.id,
        surface: "assistant",
        usedFields: requestedMemoryFields,
      });
    }

    return NextResponse.json(
      {
        reply: reply.text,
        mode: reply.mode,
        memoryUsed,
        memoryMessage: memoryUsed
          ? "KLYX a utilisé uniquement les habitudes autorisées de ta mémoire pour cette réponse."
          : null,
      },
      {
        headers: rateLimitResponseHeaders(policy, rateLimit),
      }
    );
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "ai_respond_failed",
      route: "/api/ai/respond",
      method: "POST",
      status: 500,
      code: "KLYX_AI_RESPOND_FAILED",
      startedAt,
    });
  }
}
