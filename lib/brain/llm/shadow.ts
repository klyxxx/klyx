import "server-only";

import {
  getKlyxLlmProvider,
} from "./provider";

import {
  assertNoAutomaticExecution,
} from "./safety";

export type KlyxLlmShadowContext = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed: boolean;
};

export type KlyxLlmShadowResult = {
  enabled: boolean;

  executed: boolean;

  provider: string | null;

  model: string | null;

  text: string | null;

  intent: string | null;

  confidence: number | null;

  deterministicReply: string;

  sameReply: boolean | null;

  usedForUserReply: false;

  automaticExecutionAllowed: false;

  error: string | null;
};

function isShadowEnabled(): boolean {
  return (
    process.env.KLYX_LLM_SHADOW_ENABLED
      ?.trim()
      .toLowerCase() === "true"
  );
}

function normalizeForComparison(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function runKlyxLlmShadow(
  params: {
    message: string;

    deterministicReply: string;

    context: KlyxLlmShadowContext;
  },
): Promise<KlyxLlmShadowResult> {
  if (!isShadowEnabled()) {
    return {
      enabled: false,

      executed: false,

      provider: null,

      model: null,

      text: null,

      intent: null,

      confidence: null,

      deterministicReply:
        params.deterministicReply,

      sameReply: null,

      usedForUserReply: false,

      automaticExecutionAllowed: false,

      error: null,
    };
  }

  try {
    const provider =
      getKlyxLlmProvider();

    const status =
      provider.getStatus();

    if (!status.available) {
      return {
        enabled: true,

        executed: false,

        provider:
          status.provider,

        model:
          status.model,

        text: null,

        intent: null,

        confidence: null,

        deterministicReply:
          params.deterministicReply,

        sameReply: null,

        usedForUserReply: false,

        automaticExecutionAllowed: false,

        error:
          "LLM provider unavailable.",
      };
    }

    const response =
      await provider.generate({
        messages: [
          {
            role: "user",

            content:
              params.message,
          },
        ],

        context: {
          memory:
            params.context,

          metadata: {
            mode:
              "shadow",

            deterministicReply:
              params.deterministicReply,
          },
        },

        maxOutputCharacters:
          3000,
      });

    assertNoAutomaticExecution(
      response.safety,
    );

    const llmText =
      response.text.trim();

    const sameReply =
      normalizeForComparison(
        llmText,
      ) ===
      normalizeForComparison(
        params.deterministicReply,
      );

    return {
      enabled: true,

      executed: true,

      provider:
        response.provider,

      model:
        response.model,

      text:
        llmText,

      intent:
        response.intent,

      confidence:
        response.confidence,

      deterministicReply:
        params.deterministicReply,

      sameReply,

      usedForUserReply: false,

      automaticExecutionAllowed: false,

      error: null,
    };
  } catch (error) {
    return {
      enabled: true,

      executed: false,

      provider: null,

      model: null,

      text: null,

      intent: null,

      confidence: null,

      deterministicReply:
        params.deterministicReply,

      sameReply: null,

      usedForUserReply: false,

      automaticExecutionAllowed: false,

      error:
        error instanceof Error
          ? error.message
          : "Unknown LLM shadow error.",
    };
  }
}