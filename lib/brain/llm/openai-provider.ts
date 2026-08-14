import "server-only";

import type {
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
  parseOpenAiStructuredResult,
} from "./openai-structured";

const OPENAI_RESPONSES_URL =
  "https://api.openai.com/v1/responses";

const DEFAULT_MODEL =
  "gpt-5.6-terra";

const DEFAULT_TIMEOUT_MS =
  15_000;

const MAX_TIMEOUT_MS =
  30_000;

type OpenAiResponsePayload = {
  id?: string;

  output_text?: string;

  output?: Array<{
    type?: string;

    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;

  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

function getApiKey(): string | null {
  const value =
    process.env.OPENAI_API_KEY?.trim();

  return value
    ? value
    : null;
}

function getModel(): string {
  return (
    process.env.KLYX_OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function getTimeoutMs(): number {
  const raw =
    Number(
      process.env.KLYX_OPENAI_TIMEOUT_MS,
    );

  if (
    !Number.isFinite(raw) ||
    raw <= 0
  ) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(
    Math.floor(raw),
    MAX_TIMEOUT_MS,
  );
}

function trimOutput(
  value: string,
  maxCharacters?: number,
): string {
  const normalized =
    value.trim();

  if (
    !maxCharacters ||
    !Number.isFinite(maxCharacters) ||
    maxCharacters <= 0
  ) {
    return normalized;
  }

  return normalized.slice(
    0,
    Math.floor(maxCharacters),
  );
}

function serializeMessages(
  request: KlyxLlmRequest,
): string {
  return request.messages
    .map(
      (message) =>
        `${message.role.toUpperCase()}: ${message.content}`,
    )
    .join("\n\n");
}

function serializeContext(
  request: KlyxLlmRequest,
): string {
  if (!request.context) {
    return "{}";
  }

  try {
    return JSON.stringify(
      request.context,
    );
  } catch {
    return "{}";
  }
}

function extractOutputText(
  payload: OpenAiResponsePayload,
): string {
  if (
    typeof payload.output_text === "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text;
  }

  const pieces: string[] =
    [];

  for (
    const item
    of payload.output ?? []
  ) {
    for (
      const content
      of item.content ?? []
    ) {
      if (
        typeof content.text === "string" &&
        content.text.trim()
      ) {
        pieces.push(
          content.text,
        );
      }
    }
  }

  return pieces.join("\n");
}

function buildRequestBody(
  request: KlyxLlmRequest,
  model: string,
) {
  return {
    model,

    reasoning: {
      effort: "low",
    },

    instructions:
      [
        "You are the reasoning layer of KLYX.",
        "KLYX organizes everyday services for users.",
        "Return analysis and conversational guidance only.",
        "Never claim that you published a request.",
        "Never claim that you selected a provider.",
        "Never claim that you created a booking.",
        "Never claim that you charged money.",
        "Never claim that you issued a refund.",
        "Transactional actions require deterministic application code.",
        "Transactional actions require explicit user confirmation.",
        "Answer in the user's language.",
        "Classify the request intent accurately.",
      ].join(
        "\n",
      ),

    input: [
      {
        role: "user",

        content: [
          {
            type: "input_text",

            text:
              [
                "Conversation:",
                serializeMessages(
                  request,
                ),
                "",
                "KLYX context:",
                serializeContext(
                  request,
                ),
                "",
                `Requested intent: ${
                  request.requestedIntent ??
                  "not specified"
                }`,
              ].join(
                "\n",
              ),
          },
        ],
      },
    ],

    text: {
      format: {
        type:
          "json_schema",

        name:
          "klyx_brain_response",

        strict:
          true,

        schema: {
          type:
            "object",

          additionalProperties:
            false,

          properties: {
            text: {
              type:
                "string",
            },

            intent: {
              type:
                "string",

              enum: [
                "conversation",
                "service_request",
                "recommendation",
                "memory",
                "clarification",
                "unknown",
              ],
            },

            confidence: {
              type:
                "number",

              minimum:
                0,

              maximum:
                1,
            },
          },

          required: [
            "text",
            "intent",
            "confidence",
          ],
        },
      },
    },
  };
}

export class OpenAiKlyxLlmProvider
  implements KlyxLlmProvider
{
  readonly name =
    "openai";

  getStatus(): KlyxLlmProviderStatus {
    const configured =
      Boolean(
        getApiKey(),
      );

    return {
      provider:
        this.name,

      configured,

      available:
        configured,

      model:
        configured
          ? getModel()
          : null,

      automaticExecutionAllowed:
        false,
    };
  }

  async generate(
    request: KlyxLlmRequest,
  ): Promise<KlyxLlmResponse> {
    const apiKey =
      getApiKey();

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured.",
      );
    }

    if (
      !Array.isArray(
        request.messages,
      ) ||
      request.messages.length === 0
    ) {
      throw new Error(
        "KLYX LLM request requires at least one message.",
      );
    }

    const safety =
      createKlyxLlmSafety();

    assertNoAutomaticExecution(
      safety,
    );

    const model =
      getModel();

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        getTimeoutMs(),
      );

    try {
      const response =
        await fetch(
          OPENAI_RESPONSES_URL,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                buildRequestBody(
                  request,
                  model,
                ),
              ),

            signal:
              controller.signal,

            cache:
              "no-store",
          },
        );

      if (!response.ok) {
        const errorBody =
          await response.text();

        throw new Error(
          `OpenAI Responses API failed (${response.status}): ${errorBody.slice(
            0,
            500,
          )}`,
        );
      }

      const payload =
        await response.json() as OpenAiResponsePayload;

      const rawOutput =
        extractOutputText(
          payload,
        );

      const structured =
        parseOpenAiStructuredResult(
          rawOutput,
        );

      assertNoAutomaticExecution(
        safety,
      );

      return {
        provider:
          this.name,

        model,

        text:
          trimOutput(
            structured.text,
            request.maxOutputCharacters,
          ),

        intent:
          structured.intent,

        confidence:
          structured.confidence,

        safety,

        usage: {
          inputTokens:
            payload.usage?.input_tokens,

          outputTokens:
            payload.usage?.output_tokens,

          totalTokens:
            payload.usage?.total_tokens,
        },

        metadata: {
          responseId:
            payload.id ??
            null,

          structuredOutput:
            true,

          reasoningEffort:
            "low",
        },
      };
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }
}