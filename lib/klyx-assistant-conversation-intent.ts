import "server-only";

import { getAuthenticatedProfile } from "@/lib/api-auth";
import type { KlyxAssistantIntent } from "@/lib/klyx-assistant-intent";
import { supabaseAdmin } from "@/lib/supabase-admin";

const INTENTS = new Set<KlyxAssistantIntent>([
  "service_need",
  "income_search",
  "mission_management",
  "information",
  "clarification",
]);

export async function getKlyxConversationIntent(
  request: Request,
  conversationId: string
): Promise<KlyxAssistantIntent | null> {
  const { profile } = await getAuthenticatedProfile(request);

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from("brain_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (conversationError) throw new Error(conversationError.message);
  if (!conversation) throw new Error("Conversation introuvable.");

  const { data, error } = await supabaseAdmin
    .from("brain_messages")
    .select("payload")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const payload =
    data?.payload && typeof data.payload === "object"
      ? (data.payload as Record<string, unknown>)
      : null;
  const storedIntent = payload?.assistantIntent;

  if (
    typeof storedIntent === "string" &&
    INTENTS.has(storedIntent as KlyxAssistantIntent)
  ) {
    return storedIntent as KlyxAssistantIntent;
  }

  if (
    payload &&
    ("serviceSlug" in payload || "missing" in payload || "readiness" in payload)
  ) {
    return "service_need";
  }

  return null;
}
