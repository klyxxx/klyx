import "server-only";

import type {
  KlyxBrainIntent,
  KlyxLlmProvider,
  KlyxLlmProviderStatus,
  KlyxLlmRequest,
  KlyxLlmResponse,
} from "./contracts";

import {
  assertNoAutomaticExecution,
  createKlyxLlmSafety,
} from "./safety";

import {
  OpenAiKlyxLlmProvider,
} from "./openai-provider";

const DISABLED_PROVIDER_NAME =
  "disabled";

const DISABLED_MODEL_NAME =
  "none";

function detectFallbackIntent(
  request: KlyxLlmRequest,
): KlyxBrainIntent {
  if (request.requestedIntent) {
    return request.requestedIntent;
  }

  const lastUserMessage =
    [...request.messages]
      .reverse()
      .find(
        (message) =>
          message.role === "user",
      )
      ?.content
      .trim()
      .toLowerCase() ?? "";

  if (!lastUserMessage) {
    return "unknown";
  }

  if (
    lastUserMessage.includes("réserver") ||
    lastUserMessage.includes("reserver") ||
    lastUserMessage.includes("prestataire") ||
    lastUserMessage.includes("service")
  ) {
    return "service_request";
  }

  if (
    lastUserMessage.includes("recommande") ||
    lastUserMessage.includes("meilleur")
  ) {
    return "recommendation";
  }

  if (
    lastUserMessage.includes("souviens") ||
    lastUserMessage.includes("mémoire") ||
    lastUserMessage.includes("memoire")
  ) {
    return "memory";
  }

  return "conversation";
}

class DisabledKlyxLlmProvider
  implements KlyxLlmProvider
{
  readonly name =
    DISABLED_PROVIDER_NAME;

  getStatus(): KlyxLlmProviderStatus {
    return {
      provider:
        DISABLED_PROVIDER_NAME,

      configured:
        false,

      available:
        false,

      model:
        null,

      automaticExecutionAllowed:
        false,
    };
  }

  async generate(
    request: KlyxLlmRequest,
  ): Promise<KlyxLlmResponse> {
    const safety =
      createKlyxLlmSafety();

    assertNoAutomaticExecution(
      safety,
    );

    return {
      provider:
        DISABLED_PROVIDER_NAME,

      model:
        DISABLED_MODEL_NAME,

      text:
        "",

      intent:
        detectFallbackIntent(
          request,
        ),

      confidence:
        0,

      safety,

      metadata: {
        fallbackOnly:
          true,

        reason:
          "No external LLM provider is available.",
      },
    };
  }
}

class ResilientKlyxLlmProvider
  implements KlyxLlmProvider
{
  readonly name =
    "resilient";

  constructor(
    private readonly primary: KlyxLlmProvider,
    private readonly fallback: KlyxLlmProvider,
  ) {}

  getStatus(): KlyxLlmProviderStatus {
    return this.primary.getStatus();
  }

  async generate(
    request: KlyxLlmRequest,
  ): Promise<KlyxLlmResponse> {
    try {
      const response =
        await this.primary.generate(
          request,
        );

      assertNoAutomaticExecution(
        response.safety,
      );

      return response;
    } catch (error) {
      const fallbackResponse =
        await this.fallback.generate(
          request,
        );

      assertNoAutomaticExecution(
        fallbackResponse.safety,
      );

      return {
        ...fallbackResponse,

        metadata: {
          ...(fallbackResponse.metadata ?? {}),

          fallbackFrom:
            this.primary.name,

          primaryError:
            error instanceof Error
              ? error.message
              : "Unknown LLM provider failure.",
        },
      };
    }
  }
}

let providerSingleton:
  KlyxLlmProvider | null =
  null;

export function createKlyxLlmProvider():
  KlyxLlmProvider {
  const fallback =
    new DisabledKlyxLlmProvider();

  const apiKey =
    process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return fallback;
  }

  const primary =
    new OpenAiKlyxLlmProvider();

  return new ResilientKlyxLlmProvider(
    primary,
    fallback,
  );
}

export function getKlyxLlmProvider():
  KlyxLlmProvider {
  if (!providerSingleton) {
    providerSingleton =
      createKlyxLlmProvider();
  }

  return providerSingleton;
}

export function getKlyxLlmStatus():
  KlyxLlmProviderStatus {
  return getKlyxLlmProvider()
    .getStatus();
}

export function resetKlyxLlmProviderForTests():
  void {
  providerSingleton =
    null;
}