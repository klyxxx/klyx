import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import {
  API_RATE_LIMIT_POLICIES,
  consumeApiRateLimit,
} from "@/lib/api-rate-limit";

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

const shadowSuppression = new AsyncLocalStorage<boolean>();
const SHADOW_MAX_INPUT_CHARACTERS = 4000;
const SHADOW_RATE_LIMIT_SUBJECT = "klyx-llm-shadow-global";

/**
 * Prevents a shadow LLM call inside a request path that will immediately make
 * a visible LLM call with the same deterministic result. AsyncLocalStorage
 * keeps the suppression scoped to this request instead of mutating process
 * environment shared by concurrent Vercel requests.
 */
export async function withoutKlyxLlmShadow<T>(
  operation: () => Promise<T>,
): Promise<T> {
  return shadowSuppression.run(true, operation);
}

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

function skippedShadowResult(
  params: {
    deterministicReply: string;
    error: string;
  },
): KlyxLlmShadowResult {
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

    error: params.error,
  };
}

export async function runKlyxLlmShadow(
  params: {
    message: string;

    deterministicReply: string;

    context: KlyxLlmShadowContext;
  },
): Promise<KlyxLlmShadowResult> {
  if (
    shadowSuppression.getStore() === true ||
    !isShadowEnabled()
  ) {
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

  if (params.message.length > SHADOW_MAX_INPUT_CHARACTERS) {
    return skippedShadowResult({
      deterministicReply: params.deterministicReply,
      error: "LLM shadow input exceeds the KLYX safety limit.",
    });
  }

  try {
    // The shadow is observational only and never powers the visible reply.
    // A durable global quota therefore protects OpenAI spend without blocking
    // the deterministic KLYX assistant if many requests arrive concurrently.
    const rateLimit = await consumeApiRateLimit(
      SHADOW_RATE_LIMIT_SUBJECT,
      API_RATE_LIMIT_POLICIES.brainRespond,
    );

    if (!rateLimit.allowed) {
      return skippedShadowResult({
        deterministicReply: params.deterministicReply,
        error: "LLM shadow rate limit reached.",
      });
    }

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