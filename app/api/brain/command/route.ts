import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  classifyKlyxAssistantIntent,
} from "@/lib/klyx-assistant-intent";
import {
  isKlyxAssistantMessageTooLong,
} from "@/lib/klyx-assistant-message-limits";

// KLYX_UNIFIED_ASSISTANT_INTENT_PREFLIGHT_2026_09_12

type CommandBody = {
  message?: string;
};

export async function POST(request: Request) {
  try {
    await getAuthenticatedProfile(request);

    const body = (await request.json()) as CommandBody;
    const rawMessage = body.message?.trim() ?? "";

    if (!rawMessage) {
      return NextResponse.json(
        { error: "Message manquant." },
        { status: 400 }
      );
    }

    if (isKlyxAssistantMessageTooLong(rawMessage)) {
      return NextResponse.json(
        { error: "Message trop long." },
        { status: 400 }
      );
    }

    const intent = classifyKlyxAssistantIntent(rawMessage);

    // The command endpoint is now only a deterministic preflight. Every
    // supported intent continues through /api/brain/converse so service needs,
    // income searches, mission management, information and clarifications all
    // share the same thread and conversation history.
    return NextResponse.json({
      mode: "new_request",
      assistantIntent: intent.intent,
      intentConfidence: intent.confidence,
      clarificationQuestion: intent.clarificationQuestion,
      requiresConfirmation: false,
      automaticExecutionAllowed: false,
      href: "/assistant",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Commande KLYX indisponible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
