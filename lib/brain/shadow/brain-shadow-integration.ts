import "server-only";

import type {
  KlyxBrainIntent,
  KlyxLlmMessage,
} from "../llm/contracts";

import {
  runKlyxLlmShadow,
} from "./llm-shadow";

import {
  createKlyxShadowObservation,
} from "./shadow-observation";

import {
  logKlyxShadowObservation,
} from "./shadow-observability";

export type KlyxBrainShadowInput = {
  source: string;

  messages: KlyxLlmMessage[];

  expectedIntent?: KlyxBrainIntent;

  userId?: string | null;

  profileId?: string | null;

  locale?: string | null;

  memory?: Record<string, unknown> | null;

  metadata?: Record<string, unknown> | null;
};

export async function observeBrainWithLlmShadow(
  input: KlyxBrainShadowInput,
): Promise<void> {
  if (
    process.env.KLYX_LLM_SHADOW_ENABLED !==
    "1"
  ) {
    return;
  }

  try {
    const result =
      await runKlyxLlmShadow({
        messages:
          input.messages,

        expectedIntent:
          input.expectedIntent,

        userId:
          input.userId,

        profileId:
          input.profileId,

        locale:
          input.locale,

        memory:
          input.memory,

        metadata:
          input.metadata,
      });

    const observation =
      createKlyxShadowObservation(
        input.source,
        input.expectedIntent ??
          null,
        result,
      );

    logKlyxShadowObservation(
      observation,
    );
  } catch (error) {
    console.error(
      "[KLYX_LLM_SHADOW_FAILURE]",
      error instanceof Error
        ? error.message
        : "Unknown shadow failure.",
    );
  }
}