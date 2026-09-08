export const BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS = 4000;
export const BRAIN_RESPOND_MAX_REQUEST_BYTES = 32 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BrainRespondInput = {
  conversationId?: string;
  message: string;
};

type BrainRespondParseSuccess = {
  ok: true;
  value: BrainRespondInput;
};

type BrainRespondParseFailure = {
  ok: false;
  status: 400 | 413;
  code:
    | "KLYX_BRAIN_INVALID_JSON"
    | "KLYX_BRAIN_INVALID_PAYLOAD"
    | "KLYX_BRAIN_INVALID_MESSAGE"
    | "KLYX_BRAIN_MESSAGE_TOO_LONG"
    | "KLYX_BRAIN_INVALID_CONVERSATION_ID"
    | "KLYX_BRAIN_REQUEST_TOO_LARGE";
  error: string;
};

export type BrainRespondParseResult =
  | BrainRespondParseSuccess
  | BrainRespondParseFailure;

function failure(
  code: BrainRespondParseFailure["code"],
  error: string,
  status: BrainRespondParseFailure["status"] = 400
): BrainRespondParseFailure {
  return {
    ok: false,
    status,
    code,
    error,
  };
}

async function readBoundedBody(
  request: Request
): Promise<
  | { ok: true; text: string }
  | BrainRespondParseFailure
> {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > BRAIN_RESPOND_MAX_REQUEST_BYTES
    ) {
      return failure(
        "KLYX_BRAIN_REQUEST_TOO_LARGE",
        "La requête est trop volumineuse.",
        413
      );
    }
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return failure(
      "KLYX_BRAIN_INVALID_JSON",
      "Requête JSON invalide."
    );
  }

  const decoder = new TextDecoder("utf-8", {
    fatal: true,
  });
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > BRAIN_RESPOND_MAX_REQUEST_BYTES) {
        await reader.cancel();

        return failure(
          "KLYX_BRAIN_REQUEST_TOO_LARGE",
          "La requête est trop volumineuse.",
          413
        );
      }

      text += decoder.decode(value, {
        stream: true,
      });
    }

    text += decoder.decode();
  } catch {
    return failure(
      "KLYX_BRAIN_INVALID_JSON",
      "Requête JSON invalide."
    );
  } finally {
    reader.releaseLock();
  }

  return {
    ok: true,
    text,
  };
}

export async function parseBrainRespondRequest(
  request: Request
): Promise<BrainRespondParseResult> {
  const body = await readBoundedBody(request);

  if (!body.ok) return body;

  let parsed: unknown;

  try {
    parsed = JSON.parse(body.text);
  } catch {
    return failure(
      "KLYX_BRAIN_INVALID_JSON",
      "Requête JSON invalide."
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return failure(
      "KLYX_BRAIN_INVALID_PAYLOAD",
      "La requête ne peut pas être traitée."
    );
  }

  const record = parsed as Record<string, unknown>;
  const rawMessage = record.message;

  if (typeof rawMessage !== "string") {
    return failure(
      "KLYX_BRAIN_INVALID_MESSAGE",
      "Le message est invalide."
    );
  }

  if (rawMessage.length > BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS) {
    return failure(
      "KLYX_BRAIN_MESSAGE_TOO_LONG",
      "Le message est trop long."
    );
  }

  const message = rawMessage.trim();

  if (!message) {
    return failure(
      "KLYX_BRAIN_INVALID_MESSAGE",
      "Écris un message."
    );
  }

  const rawConversationId = record.conversationId;

  if (rawConversationId === undefined) {
    return {
      ok: true,
      value: {
        message,
      },
    };
  }

  if (
    typeof rawConversationId !== "string" ||
    !UUID_PATTERN.test(rawConversationId.trim())
  ) {
    return failure(
      "KLYX_BRAIN_INVALID_CONVERSATION_ID",
      "Conversation invalide."
    );
  }

  return {
    ok: true,
    value: {
      conversationId: rawConversationId.trim(),
      message,
    },
  };
}
