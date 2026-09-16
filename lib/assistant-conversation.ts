import "server-only";

import type { AssistantIntent } from "@/lib/assistant-intent-router";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ConversationRow = {
  id: string;
  user_id: string;
};

type MessagePayloadRow = {
  payload: Record<string, unknown> | null;
};

const KNOWN_INTENTS = new Set<AssistantIntent>([
  "service_need",
  "income_search",
  "mission_management",
  "information",
  "clarification",
]);

function payloadIntent(
  payload: Record<string, unknown> | null
): AssistantIntent | null {
  if (!payload) return null;

  const explicit = payload.assistantIntent;
  if (typeof explicit === "string" && KNOWN_INTENTS.has(explicit as AssistantIntent)) {
    return explicit as AssistantIntent;
  }

  if (
    "serviceSlug" in payload ||
    "city" in payload ||
    "date" in payload ||
    "time" in payload ||
    "missing" in payload ||
    "ready" in payload
  ) {
    return "service_need";
  }

  return null;
}

export async function resolveAssistantConversation(params: {
  requestedConversationId?: string;
  profileIds: readonly string[];
  canonicalProfileId: string;
  firstMessage: string;
}): Promise<{
  conversationId: string;
  previousIntent: AssistantIntent | null;
}> {
  const {
    requestedConversationId,
    profileIds,
    canonicalProfileId,
    firstMessage,
  } = params;

  if (!requestedConversationId) {
    const { data, error } = await supabaseAdmin
      .from("brain_conversations")
      .insert({
        user_id: canonicalProfileId,
        title: firstMessage.slice(0, 60),
      })
      .select("id, user_id")
      .single();

    if (error) throw new Error(error.message);

    return {
      conversationId: (data as ConversationRow).id,
      previousIntent: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("brain_conversations")
    .select("id, user_id")
    .eq("id", requestedConversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const conversation = data as ConversationRow | null;
  if (!conversation || !profileIds.includes(conversation.user_id)) {
    throw new Error("Conversation introuvable.");
  }

  if (conversation.user_id !== canonicalProfileId) {
    const { error: reanchorError } = await supabaseAdmin
      .from("brain_conversations")
      .update({ user_id: canonicalProfileId })
      .eq("id", conversation.id)
      .eq("user_id", conversation.user_id);

    if (reanchorError) throw new Error(reanchorError.message);
  }

  const { data: lastMessage, error: messageError } = await supabaseAdmin
    .from("brain_messages")
    .select("payload")
    .eq("conversation_id", conversation.id)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (messageError) throw new Error(messageError.message);

  return {
    conversationId: conversation.id,
    previousIntent: payloadIntent(
      (lastMessage as MessagePayloadRow | null)?.payload ?? null
    ),
  };
}

export async function appendAssistantExchange(params: {
  conversationId: string;
  userMessage: string;
  assistantReply: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { conversationId, userMessage, assistantReply, payload } = params;

  const { error: messagesError } = await supabaseAdmin
    .from("brain_messages")
    .insert([
      {
        conversation_id: conversationId,
        role: "user",
        content: userMessage,
        payload: {},
      },
      {
        conversation_id: conversationId,
        role: "assistant",
        content: assistantReply,
        payload,
      },
    ]);

  if (messagesError) throw new Error(messagesError.message);

  const { error: touchError } = await supabaseAdmin
    .from("brain_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (touchError) throw new Error(touchError.message);
}
