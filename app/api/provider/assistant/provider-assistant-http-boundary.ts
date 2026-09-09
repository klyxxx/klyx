export const PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS = 1000;
export const PROVIDER_ASSISTANT_MAX_REQUEST_BYTES = 32 * 1024;

type ProviderAssistantPostInput = {
  message: string;
};

type ProviderAssistantPatchInput = {
  draftId: string;
  action: "apply" | "discard";
};

type ProviderAssistantParseFailure = {
  ok: false;
  status: 400 | 413;
  code:
    | "KLYX_PROVIDER_ASSISTANT_INVALID_JSON"
    | "KLYX_PROVIDER_ASSISTANT_INVALID_PAYLOAD"
    | "KLYX_PROVIDER_ASSISTANT_INVALID_MESSAGE"
    | "KLYX_PROVIDER_ASSISTANT_MESSAGE_TOO_LONG"
    | "KLYX_PROVIDER_ASSISTANT_REQUEST_TOO_LARGE"
    | "KLYX_PROVIDER_ASSISTANT_INVALID_ACTION";
  error: string;
};

type ProviderAssistantPostParseResult =
  | { ok: true; value: ProviderAssistantPostInput }
  | ProviderAssistantParseFailure;

type ProviderAssistantPatchParseResult =
  | { ok: true; value: ProviderAssistantPatchInput }
  | ProviderAssistantParseFailure;

function failure(
  code: ProviderAssistantParseFailure["code"],
  error: string,
  status: ProviderAssistantParseFailure["status"] = 400
): ProviderAssistantParseFailure {
  return {
    ok: false,
    status,
    code,
    error,
  };
}

async function readBoundedJsonObject(
  request: Request
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | ProviderAssistantParseFailure
> {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > PROVIDER_ASSISTANT_MAX_REQUEST_BYTES
    ) {
      return failure(
        "KLYX_PROVIDER_ASSISTANT_REQUEST_TOO_LARGE",
        "La requête est trop volumineuse.",
        413
      );
    }
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_INVALID_JSON",
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

      if (totalBytes > PROVIDER_ASSISTANT_MAX_REQUEST_BYTES) {
        await reader.cancel();

        return failure(
          "KLYX_PROVIDER_ASSISTANT_REQUEST_TOO_LARGE",
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
      "KLYX_PROVIDER_ASSISTANT_INVALID_JSON",
      "Requête JSON invalide."
    );
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_INVALID_JSON",
      "Requête JSON invalide."
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_INVALID_PAYLOAD",
      "La requête ne peut pas être traitée."
    );
  }

  return {
    ok: true,
    value: parsed as Record<string, unknown>,
  };
}

export async function parseProviderAssistantPostRequest(
  request: Request
): Promise<ProviderAssistantPostParseResult> {
  const body = await readBoundedJsonObject(request);

  if (!body.ok) return body;

  const rawMessage = body.value.message;

  if (typeof rawMessage !== "string") {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_INVALID_MESSAGE",
      "Le message est invalide."
    );
  }

  if (rawMessage.length > PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS) {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_MESSAGE_TOO_LONG",
      "Le message est trop long."
    );
  }

  const message = rawMessage.trim();

  if (message.length < 3) {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_INVALID_MESSAGE",
      "Décris ce que tu veux préparer."
    );
  }

  return {
    ok: true,
    value: {
      message,
    },
  };
}

export async function parseProviderAssistantPatchRequest(
  request: Request
): Promise<ProviderAssistantPatchParseResult> {
  const body = await readBoundedJsonObject(request);

  if (!body.ok) return body;

  const draftId =
    typeof body.value.draftId === "string"
      ? body.value.draftId.trim()
      : "";
  const action = body.value.action;

  if (
    !draftId ||
    (action !== "apply" && action !== "discard")
  ) {
    return failure(
      "KLYX_PROVIDER_ASSISTANT_INVALID_ACTION",
      "Action invalide."
    );
  }

  return {
    ok: true,
    value: {
      draftId,
      action,
    },
  };
}
