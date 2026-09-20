import "server-only";

import type { AssistantIntent } from "@/lib/assistant-intent-router";
import {
  createOrResumeWorkflow,
  findLatestActiveWorkflow,
  transitionWorkflow,
  type WorkflowSnapshot,
} from "@/lib/brain/orchestrator/repository";

export type PublicAssistantWorkflow = WorkflowSnapshot;

function modeForIntent(intent: AssistantIntent): "request" | "earn" | null {
  if (intent === "service_need") return "request";
  if (intent === "income_search") return "earn";
  return null;
}

export async function resolveAssistantWorkflow(params: {
  accountId: string;
  profileId: string;
  conversationId: string | null;
  intent: AssistantIntent;
  context?: Record<string, unknown>;
}): Promise<PublicAssistantWorkflow | null> {
  const mode = modeForIntent(params.intent);

  if (!mode) {
    if (params.intent !== "mission_management") return null;

    return findLatestActiveWorkflow({
      accountId: params.accountId,
      conversationId: params.conversationId,
    });
  }

  let workflow = await createOrResumeWorkflow({
    accountId: params.accountId,
    profileId: params.profileId,
    conversationId: params.conversationId,
    mode,
    context: params.context,
  });

  if (
    mode === "request" &&
    workflow.currentStep === "intention"
  ) {
    workflow = await transitionWorkflow({
      accountId: params.accountId,
      workflow,
      toStep: "comprehension",
      eventType: "assistant_intent_understood",
      actorType: "server",
      payload: {
        source: "assistant_intent_router",
        automaticSensitiveExecutionAllowed: false,
      },
    });
  }

  return workflow;
}
