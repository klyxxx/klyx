import "server-only";

import type {
  KlyxBrainIntent,
  KlyxLlmMessage,
  KlyxLlmResponse,
} from "../llm/contracts";

import {
  getKlyxLlmProvider,
} from "../llm/provider";

import {
  assertNoAutomaticExecution,
} from "../llm/safety";

export type KlyxShadowInput = {
  messages: KlyxLlmMessage[];

  expectedIntent?: KlyxBrainIntent;

  userId?: string | null;

  profileId?: string | null;

  locale?: string | null;

  memory?: Record<string, unknown> | null;

  metadata?: Record<string, unknown> | null;
};

export type KlyxShadowResult = {
  attempted: boolean;

  available: boolean;

  provider: string | null;

  model: string | null;

  intent: KlyxBrainIntent | null;

  confidence: number | null;

  text: string | null;

  agreementWithExpectedIntent: boolean | null;

  automaticExecutionAllowed: false;

  error: string | null;
};

export async function runKlyxLlmShadow(
  input: KlyxShadowInput,
): Promise<KlyxShadowResult> {
  const provider =
    getKlyxLlmProvider();

  const status =
    provider.getStatus();

  if (
    !status.configured ||
    !status.available
  ) {
    return {
      attempted:
        false,

      available:
        false,

      provider:
        status.provider,

      model:
        status.model,

      intent:
        null,

      confidence:
        null,

      text:
        null,

      agreementWithExpectedIntent:
        null,

      automaticExecutionAllowed:
        false,

      error:
        null,
    };
  }

  try {
    const response:
      KlyxLlmResponse =
      await provider.generate({
        messages:
          input.messages,

        requestedIntent:
          input.expectedIntent,

        maxOutputCharacters:
          2_000,

        context: {
          userId:
            input.userId,

          profileId:
            input.profileId,

          locale:
            input.locale,

          memory:
            input.memory,

          metadata: {
            ...(input.metadata ?? {}),

            mode:
              "shadow",

            automaticExecutionAllowed:
              false,
          },
        },
      });

    assertNoAutomaticExecution(
      response.safety,
    );

    return {
      attempted:
        true,

      available:
        true,

      provider:
        response.provider,

      model:
        response.model,

      intent:
        response.intent,

      confidence:
        response.confidence,

      text:
        response.text,

      agreementWithExpectedIntent:
        input.expectedIntent
          ? response.intent ===
            input.expectedIntent
          : null,

      automaticExecutionAllowed:
        false,

      error:
        null,
    };
  } catch (error) {
    return {
      attempted:
        true,

      available:
        true,

      provider:
        status.provider,

      model:
        status.model,

      intent:
        null,

      confidence:
        null,

      text:
        null,

      agreementWithExpectedIntent:
        null,

      automaticExecutionAllowed:
        false,

      error:
        error instanceof Error
          ? error.message
          : "Unknown KLYX LLM shadow failure.",
    };
  }
}