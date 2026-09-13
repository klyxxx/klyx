import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MessageRow = {
  role: string;
  content: string | null;
  payload: unknown;
};

type CanonicalRequest = {
  serviceSlug: string;
  city: string;
  date: string;
  time: string;
  budget: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isConfirmationPayload(value: unknown): boolean {
  return isRecord(value) && value.action === "confirm_request";
}

function compactDescription(rows: MessageRow[]): string {
  const messages = rows
    .filter(
      (row) =>
        row.role === "user" &&
        !isConfirmationPayload(row.payload) &&
        typeof row.content === "string" &&
        row.content.trim()
    )
    .map((row) => row.content!.trim())
    .filter(
      (value, index, values) => index === 0 || value !== values[index - 1]
    );

  return messages.join(" · ").slice(0, 2000);
}

function canonicalReadyRequest(rows: MessageRow[]): CanonicalRequest | null {
  const assistant = [...rows]
    .reverse()
    .find((row) => row.role === "assistant" && isRecord(row.payload));

  if (!assistant || !isRecord(assistant.payload)) return null;
  if (assistant.payload.ready !== true) return null;

  const serviceSlug = clean(assistant.payload.serviceSlug, 100);
  const city = clean(assistant.payload.city, 100);
  const date = clean(assistant.payload.date, 10);
  const time = clean(assistant.payload.time, 5);
  const rawBudget = assistant.payload.budget;
  const budget =
    rawBudget == null
      ? null
      : typeof rawBudget === "number" && Number.isFinite(rawBudget) && rawBudget >= 0
        ? rawBudget
        : null;

  if (!serviceSlug || !city || !date || !time) return null;

  return { serviceSlug, city, date, time, budget };
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const conversationId = new URL(request.url).searchParams
      .get("conversationId")
      ?.trim();

    if (!conversationId || !UUID_PATTERN.test(conversationId)) {
      return NextResponse.json(
        { error: "Conversation KLYX invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("brain_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (conversationError) throw new Error(conversationError.message);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation KLYX introuvable." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("brain_messages")
      .select("role, content, payload")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(80);

    if (messagesError) throw new Error(messagesError.message);

    const rows = (messages ?? []) as MessageRow[];
    const requestSnapshot = canonicalReadyRequest(rows);

    if (!requestSnapshot) {
      return NextResponse.json(
        {
          error:
            "Cette conversation n'a pas encore de demande complète prête à être confirmée.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        conversationId,
        request: requestSnapshot,
        description: compactDescription(rows),
        source: "durable_brain_messages",
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brouillon KLYX indisponible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "assistant_request_draft_failed",
      route: "/api/brain/request-draft",
      method: "GET",
      status,
      code: "KLYX_ASSISTANT_REQUEST_DRAFT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
