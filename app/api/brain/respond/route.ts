import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  brainServiceLabel,
  resolveBrainPreferredServiceSlug,
  resolveBrainServiceSlug,
  type BrainServiceCatalogRecord,
} from "@/lib/brain-service-catalog";
import {
  runKlyxLlmShadow,
} from "@/lib/brain/llm/shadow";
import type {
  KlyxPublicShadowStatus,
} from "@/lib/brain/shadow/shadow-public";
import {
  sanitizeKlyxShadowForClient,
} from "@/lib/brain/shadow/shadow-sanitizer";
import {
  parseMultiSlotSchedule,
  type BrainMultiSlotSchedule,
} from "@/lib/brain-multi-slot";

// KLYX_SERVER_OBSERVABILITY_12B_8B
import {
  logServerInfo,
  logServerWarning,
} from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

type BrainContext = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed: boolean;
};

type BrainReadinessPayload = {
  score: number;
  label: string;
  isComplete: boolean;
  remainingCount: number;
  missing: string[];
  nextMissing: string | null;
  nextStep:
    | "confirm_request"
    | "collect_missing_information";
  requiresConfirmation: boolean;
  confirmationState:
    | "awaiting_user_confirmation"
    | "not_ready";
  confirmationOptions: Array<{
    id: "confirm" | "edit";
    action: "confirm_request" | "edit_request";
    label: "Confirmer" | "Modifier";
  }>;
  summary: {
    service: string;
    city: string;
    date: string;
    time: string;
  } | null;
  automaticExecutionAllowed: false;
};

type BrainPayload = BrainContext & {
  missing: string[];
  ready: boolean;
  readiness: BrainReadinessPayload;
  schedule: BrainMultiSlotSchedule | null;
  llmShadow?: KlyxPublicShadowStatus;
};

type ConversationRow = {
  id: string;
};

type MessagePayloadRow = {
  payload: Partial<BrainPayload> | null;
};

type PreferencesRow = {
  default_city: string | null;
  default_budget: number | null;
  preferred_service_slugs: string[] | null;
  ai_memory_enabled: boolean | null;
  scheduling_notes: string | null;
};

type CityRule = {
  city: string;
  aliases: string[];
};

const CITY_RULES: CityRule[] = [
  {
    city: "Bruxelles",
    aliases: ["bruxelles", "brussel", "bxl", "bx", "bruxel"],
  },
  {
    city: "Anderlecht",
    aliases: ["anderlecht"],
  },
  {
    city: "Schaerbeek",
    aliases: ["schaerbeek", "schaarbeek"],
  },
  {
    city: "Ixelles",
    aliases: ["ixelles", "elsene"],
  },
  {
    city: "Uccle",
    aliases: ["uccle", "ukkel"],
  },
  {
    city: "Etterbeek",
    aliases: ["etterbeek"],
  },
  {
    city: "Forest",
    aliases: ["forest", "vorst"],
  },
  {
    city: "Saint-Gilles",
    aliases: ["saint gilles", "sint gillis"],
  },
  {
    city: "Jette",
    aliases: ["jette"],
  },
  {
    city: "Evere",
    aliases: ["evere"],
  },
  {
    city: "Molenbeek-Saint-Jean",
    aliases: [
      "molenbeek",
      "molenbeek saint jean",
      "sint jans molenbeek",
    ],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’`-]/g, " ")
    .replace(/[^a-z0-9€\s:/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0)
  );

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function approximatelyContains(
  text: string,
  expression: string
): boolean {
  const normalizedText = normalize(text);
  const normalizedExpression = normalize(expression);

  if (!normalizedExpression) return false;
  if (normalizedText.includes(normalizedExpression)) return true;

  const textWords = normalizedText.split(" ");
  const expressionWords = normalizedExpression.split(" ");

  if (expressionWords.length === 1) {
    const maximumDistance =
      normalizedExpression.length <= 5 ? 1 : 2;

    return textWords.some(
      (word) =>
        levenshtein(word, normalizedExpression) <=
        maximumDistance
    );
  }

  for (
    let index = 0;
    index <= textWords.length - expressionWords.length;
    index += 1
  ) {
    const candidate = textWords
      .slice(index, index + expressionWords.length)
      .join(" ");
    const maximumDistance =
      normalizedExpression.length <= 10 ? 2 : 3;

    if (
      levenshtein(candidate, normalizedExpression) <=
      maximumDistance
    ) {
      return true;
    }
  }

  return false;
}

function detectCity(text: string): string | null {
  for (const rule of CITY_RULES) {
    const matches = rule.aliases.some((alias) =>
      approximatelyContains(text, alias)
    );

    if (matches) return rule.city;
  }

  return null;
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function detectDate(text: string): string | null {
  const value = normalize(text);
  const now = new Date();

  if (
    value.includes("aujourd hui") ||
    value.includes("aujourdhui") ||
    value.includes("aujoudhui")
  ) {
    return toLocalIsoDate(now);
  }

  if (
    value.includes("apres demain") ||
    value.includes("apresdemain")
  ) {
    const date = new Date(now);
    date.setDate(date.getDate() + 2);
    return toLocalIsoDate(date);
  }

  if (
    value.includes("demain") ||
    approximatelyContains(value, "demain")
  ) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return toLocalIsoDate(date);
  }

  const weekdayRules = [
    { day: 1, aliases: ["lundi"] },
    { day: 2, aliases: ["mardi"] },
    { day: 3, aliases: ["mercredi"] },
    { day: 4, aliases: ["jeudi"] },
    { day: 5, aliases: ["vendredi"] },
    { day: 6, aliases: ["samedi"] },
    { day: 0, aliases: ["dimanche"] },
  ];

  for (const rule of weekdayRules) {
    if (
      rule.aliases.some((alias) =>
        approximatelyContains(value, alias)
      )
    ) {
      const date = new Date(now);
      const currentDay = date.getDay();
      let daysAhead = (rule.day - currentDay + 7) % 7;

      if (daysAhead === 0) daysAhead = 7;

      date.setDate(date.getDate() + daysAhead);
      return toLocalIsoDate(date);
    }
  }

  const numericMatch = text.match(
    /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/
  );

  if (!numericMatch) return null;

  const day = Number(numericMatch[1]);
  const month = Number(numericMatch[2]);
  let year = numericMatch[3]
    ? Number(numericMatch[3])
    : now.getFullYear();

  if (year < 100) year += 2000;

  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return valid ? toLocalIsoDate(date) : null;
}

function detectTime(text: string): string | null {
  // KLYX_ZERO_COST_EXPLICIT_TIME_12B_7B
  const explicitTimeMatch = text.match(
    /\b(?:vers\s+|à\s+|a\s+)?([01]?\d|2[0-3])\s*(?:h|heure|heures|:)\s*([0-5]?\d)?\b/i
  );

  if (explicitTimeMatch) {
    const hours = Number(explicitTimeMatch[1]);
    const minutes = Number(explicitTimeMatch[2] ?? "0");

    return `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}`;
  }

  const value = normalize(text);
  const naturalTimes = [
    {
      expressions: ["midi", "a midi", "vers midi"],
      time: "12:00",
    },
    {
      expressions: ["minuit", "a minuit", "vers minuit"],
      time: "00:00",
    },
    {
      expressions: [
        "le matin",
        "dans la matinee",
        "en matinee",
        "matin",
      ],
      time: "09:00",
    },
    {
      expressions: [
        "l apres midi",
        "dans l apres midi",
        "apres midi",
      ],
      time: "14:00",
    },
    {
      expressions: [
        "le soir",
        "dans la soiree",
        "en soiree",
        "soir",
      ],
      time: "18:00",
    },
  ];

  for (const naturalTime of naturalTimes) {
    if (
      naturalTime.expressions.some((expression) =>
        approximatelyContains(value, expression)
      )
    ) {
      return naturalTime.time;
    }
  }

  const match = value.match(
    /\b(?:vers\s+|a\s+)?(\d{1,2})(?:\s*(?:h|heure|heures|:)\s*(\d{1,2}))?\b/
  );

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`;
}

function detectBudget(text: string): number | null {
  const normalizedBudgetText = normalize(text);
  const budgetPatterns = [
    /(?:budget|maximum|max|jusqu a|pas plus de)\s*(?:de|est|a|:)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)?/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)\s*(?:max|maximum)/i,
    /(?:pour|avec)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)/i,
  ];

  for (const pattern of budgetPatterns) {
    const match = normalizedBudgetText.match(pattern);
    if (!match) continue;

    const amount = Number(match[1].replace(",", "."));

    if (
      Number.isFinite(amount) &&
      amount > 0 &&
      amount <= 1000000
    ) {
      return Math.round(amount * 100) / 100;
    }
  }

  const value = normalize(text);
  const match = value.match(
    /(?:budget|maximum|max|jusqu a|jusqua)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|euros)\b/
  );

  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

function wantsMemory(text: string): boolean {
  return [
    "comme d habitude",
    "comme dhabitude",
    "pareil que la derniere fois",
    "la meme chose",
    "comme avant",
  ].some((expression) =>
    approximatelyContains(text, expression)
  );
}

async function loadServiceCatalog(): Promise<
  BrainServiceCatalogRecord[]
> {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("slug, name")
    .limit(1000);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(
    (service): service is BrainServiceCatalogRecord =>
      typeof service.slug === "string" &&
      service.slug.trim().length > 0 &&
      (service.name == null ||
        typeof service.name === "string")
  );
}

function mergeContext(
  previous: BrainContext,
  currentMessage: string,
  services: readonly BrainServiceCatalogRecord[]
): BrainContext {
  return {
    serviceSlug: resolveBrainServiceSlug({
      text: currentMessage,
      previousSlug: previous.serviceSlug,
      services,
    }),
    city: detectCity(currentMessage) ?? previous.city,
    date: detectDate(currentMessage) ?? previous.date,
    time: detectTime(currentMessage) ?? previous.time,
    budget:
      detectBudget(currentMessage) ?? previous.budget,
    memoryUsed: previous.memoryUsed,
  };
}

async function createConversation(
  userId: string,
  firstMessage: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("brain_conversations")
    .insert({
      user_id: userId,
      title: firstMessage.slice(0, 60),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return (data as ConversationRow).id;
}

async function verifyConversationOwnership(
  conversationId: string,
  userId: string
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("brain_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Conversation introuvable.");
}

async function resolveConversationId(
  userId: string,
  requestedConversationId: string | undefined,
  firstMessage: string
): Promise<string> {
  if (!requestedConversationId) {
    return createConversation(userId, firstMessage);
  }

  await verifyConversationOwnership(
    requestedConversationId,
    userId
  );

  return requestedConversationId;
}

async function getPreviousContext(
  conversationId: string
): Promise<BrainContext> {
  const { data, error } = await supabaseAdmin
    .from("brain_messages")
    .select("payload")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as MessagePayloadRow | null;
  const payload = row?.payload ?? null;

  return {
    serviceSlug: payload?.serviceSlug ?? null,
    city: payload?.city ?? null,
    date: payload?.date ?? null,
    time: payload?.time ?? null,
    budget:
      typeof payload?.budget === "number"
        ? payload.budget
        : null,
    memoryUsed: Boolean(payload?.memoryUsed),
  };
}

async function applyUserMemory(
  userId: string,
  message: string,
  context: BrainContext,
  services: readonly BrainServiceCatalogRecord[]
): Promise<BrainContext> {
  if (!wantsMemory(message)) return context;

  const { data, error } = await supabaseAdmin
    .from("user_preferences")
    .select(
      "default_city, default_budget, preferred_service_slugs, ai_memory_enabled, scheduling_notes"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const preferences = data as PreferencesRow | null;

  if (!preferences?.ai_memory_enabled) return context;

  return {
    ...context,
    serviceSlug:
      context.serviceSlug ??
      resolveBrainPreferredServiceSlug(
        preferences.preferred_service_slugs,
        services
      ),
    city:
      context.city ??
      preferences.default_city ??
      null,
    time:
      context.time ??
      detectTime(preferences.scheduling_notes ?? ""),
    budget:
      context.budget ??
      (preferences.default_budget != null
        ? Number(preferences.default_budget)
        : null),
    memoryUsed: true,
  };
}

function buildMissingFields(
  context: BrainContext
): string[] {
  const missing: string[] = [];

  if (!context.serviceSlug) missing.push("service");
  if (!context.city) missing.push("ville");
  if (!context.date) missing.push("date");
  if (!context.time) missing.push("heure");

  return missing;
}

function knownContextSummary(
  context: BrainContext,
  services: readonly BrainServiceCatalogRecord[]
): string {
  const parts: string[] = [];

  if (context.serviceSlug) {
    parts.push(
      brainServiceLabel(context.serviceSlug, services)
    );
  }

  if (context.city) parts.push(`à ${context.city}`);
  if (context.date) parts.push(`le ${context.date}`);
  if (context.time) parts.push(`à ${context.time}`);

  if (context.budget != null) {
    parts.push(
      `budget max ${context.budget.toFixed(2)} €`
    );
  }

  return parts.join(", ");
}

function buildReadinessPayload(
  context: BrainContext,
  missing: string[]
): BrainReadinessPayload {
  const remainingCount = missing.length;
  const score = Math.round(
    ((4 - remainingCount) / 4) * 100
  );
  const label =
    score === 100
      ? "Demande complète"
      : score >= 75
        ? "Presque prête"
        : score >= 50
          ? "Demande en cours"
          : "Je précise ton besoin";
  const isComplete = score === 100;
  const nextMissing = missing[0] ?? null;
  const summary =
    isComplete &&
    context.serviceSlug &&
    context.city &&
    context.date &&
    context.time
      ? {
          service: context.serviceSlug,
          city: context.city,
          date: context.date,
          time: context.time,
        }
      : null;

  return {
    score,
    label,
    isComplete,
    remainingCount,
    missing: [...missing],
    nextMissing,
    nextStep: isComplete
      ? "confirm_request"
      : "collect_missing_information",
    requiresConfirmation: isComplete,
    confirmationState: isComplete
      ? "awaiting_user_confirmation"
      : "not_ready",
    confirmationOptions: isComplete
      ? [
          {
            id: "confirm",
            action: "confirm_request",
            label: "Confirmer",
          },
          {
            id: "edit",
            action: "edit_request",
            label: "Modifier",
          },
        ]
      : [],
    summary,
    automaticExecutionAllowed: false,
  };
}

function buildReply(
  context: BrainContext,
  missing: string[],
  services: readonly BrainServiceCatalogRecord[]
): string {
  const completionScore = Math.round(
    ((4 - missing.length) / 4) * 100
  );
  const completionLabel =
    completionScore === 100
      ? "Demande complète"
      : completionScore >= 75
        ? "Presque prête"
        : completionScore >= 50
          ? "Demande en cours"
          : "Je précise ton besoin";
  const completionStatusText =
    missing.length === 0
      ? `${completionLabel} (${completionScore} %)`
      : `${completionLabel} (${completionScore} %) - ${
          missing.length
        } information${
          missing.length > 1 ? "s" : ""
        } restante${missing.length > 1 ? "s" : ""}`;
  const guidedQuestions: Record<string, string> = {
    service:
      "De quel service as-tu besoin ? Décris simplement le travail à faire, même si tu ne connais pas le nom exact du métier.",
    ville:
      "Dans quelle ville ou commune la prestation doit-elle avoir lieu ?",
    date:
      "Quel jour souhaites-tu la prestation ? Tu peux répondre naturellement : demain, samedi, lundi prochain ou avec une date.",
    heure:
      "À quel moment souhaites-tu la prestation ? Par exemple : 10h30, midi, le matin, l’après-midi ou le soir.",
  };
  const firstMissing = missing[0] ?? null;

  if (firstMissing) {
    const summary = knownContextSummary(context, services);
    const question =
      guidedQuestions[firstMissing] ??
      "Peux-tu préciser ta demande ?";

    return summary
      ? `${completionStatusText}\n\nJ’ai déjà compris : ${summary}. ${question}`
      : `${completionStatusText}\n\n${question}`;
  }

  const service = brainServiceLabel(
    context.serviceSlug,
    services
  );
  const confirmationText =
    `Service: ${service} | Ville: ${context.city} | ` +
    `Date: ${context.date} | Heure: ${context.time}`;

  return (
    `${completionStatusText}\n\n${confirmationText}\n\n` +
    "Ta demande est complète. Vérifie le résumé puis confirme avant toute publication, réservation ou paiement."
  );
}

async function insertBrainMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("brain_messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      payload: params.payload ?? {},
    });

  if (error) throw new Error(error.message);
}

async function touchConversation(
  conversationId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("brain_conversations")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      conversationId?: string;
      message?: string;
    };
    const message = body.message?.trim();

    if (!message) {
      logServerWarning({
        event: "brain_request_rejected",
        route: "/api/brain/respond",
        method: "POST",
        status: 400,
        code: "message_required",
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        { error: "Écris un message." },
        { status: 400 }
      );
    }

    const [conversationId, services] = await Promise.all([
      resolveConversationId(
        profile.id,
        body.conversationId,
        message
      ),
      loadServiceCatalog(),
    ]);
    const previousContext =
      await getPreviousContext(conversationId);
    const mergedContext = mergeContext(
      previousContext,
      message,
      services
    );
    const memoryContext = await applyUserMemory(
      profile.id,
      message,
      mergedContext,
      services
    );
    const schedule = parseMultiSlotSchedule(message, {
      fallbackBudget: memoryContext.budget,
    });
    const context: BrainContext = schedule
      ? {
          ...memoryContext,
          date:
            schedule.slots[0]?.date ??
            memoryContext.date,
          time:
            schedule.slots[0]?.startTime ??
            memoryContext.time,
          budget:
            schedule.slots[0]?.budget ??
            memoryContext.budget,
        }
      : memoryContext;
    const missing = buildMissingFields(context);
    const ready = missing.length === 0;
    const reply = buildReply(context, missing, services);
    const readiness = buildReadinessPayload(
      context,
      missing
    );

    const llmShadow = await runKlyxLlmShadow({
      message,
      deterministicReply: reply,
      context: {
        serviceSlug: context.serviceSlug,
        city: context.city,
        date: context.date,
        time: context.time,
        budget: context.budget,
        memoryUsed: context.memoryUsed,
      },
    });
    const publicLlmShadow = sanitizeKlyxShadowForClient(
      llmShadow,
      process.env.KLYX_LLM_SHADOW_ENABLED === "1"
    );
    const payload: BrainPayload = {
      ...context,
      missing,
      ready,
      readiness,
      schedule,
      llmShadow: publicLlmShadow,
    };

    await insertBrainMessage({
      conversationId,
      role: "user",
      content: message,
    });
    await insertBrainMessage({
      conversationId,
      role: "assistant",
      content: reply,
      payload,
    });
    await touchConversation(conversationId);

    logServerInfo({
      event: "brain_request_completed",
      route: "/api/brain/respond",
      method: "POST",
      status: 200,
      code: ready ? "ready" : "collecting",
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      conversationId,
      reply,
      payload,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "KLYX Brain est indisponible.";
    const status =
      message === "Conversation introuvable."
        ? 404
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "brain_request_failed",
      route: "/api/brain/respond",
      method: "POST",
      status,
      code: "brain_request_failed",
      publicMessage:
        status < 500 ? message : undefined,
      startedAt,
    });
  }
}
