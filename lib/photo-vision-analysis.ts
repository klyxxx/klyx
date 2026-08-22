import "server-only";

export type PhotoVisualEvidence = {
  visualSummary: string;
  serviceHints: string[];
  confidence: number;
};

export type PhotoVisionResult = {
  enabled: boolean;
  used: boolean;
  provider: "openai" | "none";
  model: string | null;
  evidence: PhotoVisualEvidence | null;
  fallbackReason: string | null;
};

type AnalyzePhotoVisionInput = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  userDescription: string;
};

const MAX_VISION_BYTES = 10 * 1024 * 1024;
const DEFAULT_VISION_MODEL = "gpt-5-mini";

const VISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visualSummary: {
      type: "string",
      minLength: 1,
      maxLength: 700,
    },
    serviceHints: {
      type: "array",
      minItems: 0,
      maxItems: 8,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 80,
      },
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
  },
  required: [
    "visualSummary",
    "serviceHints",
    "confidence",
  ],
} as const;

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string") {
    return record.output_text.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const content = Array.isArray(
      (item as Record<string, unknown>).content
    )
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];

    for (const part of content) {
      if (!part || typeof part !== "object") continue;

      const text = (part as Record<string, unknown>).text;

      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }

  return "";
}

function cleanEvidence(value: unknown): PhotoVisualEvidence | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const visualSummary =
    typeof record.visualSummary === "string"
      ? record.visualSummary.trim().slice(0, 700)
      : "";
  const confidence = Number(record.confidence);
  const serviceHints = Array.isArray(record.serviceHints)
    ? [
        ...new Set(
          record.serviceHints
            .filter(
              (item): item is string =>
                typeof item === "string"
            )
            .map((item) => item.trim().slice(0, 80))
            .filter(Boolean)
        ),
      ].slice(0, 8)
    : [];

  if (
    !visualSummary ||
    !Number.isInteger(confidence) ||
    confidence < 0 ||
    confidence > 100
  ) {
    return null;
  }

  return {
    visualSummary,
    serviceHints,
    confidence,
  };
}

export function isPhotoVisionEnabled(): boolean {
  return (
    process.env.KLYX_VISION_ENABLED === "1" &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  );
}

export async function analyzePhotoVisualContent(
  input: AnalyzePhotoVisionInput
): Promise<PhotoVisionResult> {
  const enabled = isPhotoVisionEnabled();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model =
    process.env.KLYX_VISION_MODEL?.trim() ||
    process.env.KLYX_OPENAI_MODEL?.trim() ||
    DEFAULT_VISION_MODEL;

  if (!enabled || !apiKey) {
    return {
      enabled,
      used: false,
      provider: "none",
      model: null,
      evidence: null,
      fallbackReason: "vision_disabled",
    };
  }

  if (
    input.bytes.byteLength <= 0 ||
    input.bytes.byteLength > MAX_VISION_BYTES
  ) {
    return {
      enabled: true,
      used: false,
      provider: "none",
      model: null,
      evidence: null,
      fallbackReason: "invalid_image_size",
    };
  }

  const base64 = Buffer.from(input.bytes).toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64}`;
  const description = input.userDescription.trim().slice(0, 1500);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: [
          "Tu analyses une photo privée envoyée à KLYX pour identifier le type de service du quotidien potentiellement nécessaire.",
          "Décris uniquement les éléments visuels utiles au besoin de service : objets, pièces, saleté, dégâts, installation ou tâche visible.",
          "N'identifie jamais une personne et n'infère jamais identité, origine, religion, santé, handicap, orientation sexuelle, opinion politique, situation financière ou autre caractéristique personnelle sensible.",
          "Si une personne, un document, une plaque ou une information personnelle est visible, ignore son identité et concentre-toi uniquement sur le besoin de service non sensible.",
          "Ne prétends jamais qu'un diagnostic technique est certain. Utilise des formulations observables et prudentes.",
          "serviceHints doit contenir de courts termes français utiles pour retrouver un métier ou service dans un catalogue, par exemple plomberie, électricité, ménage, déménagement, montage meuble, jardinage.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: description
                  ? `Description fournie par le client : ${description}`
                  : "Aucune description textuelle supplémentaire.",
              },
              {
                type: "input_image",
                image_url: dataUrl,
                detail: "low",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "klyx_photo_visual_evidence",
            strict: true,
            schema: VISION_SCHEMA,
          },
          verbosity: "low",
        },
        max_output_tokens: 350,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return {
        enabled: true,
        used: false,
        provider: "none",
        model: null,
        evidence: null,
        fallbackReason: `vision_http_${response.status}`,
      };
    }

    const payload = (await response.json()) as unknown;
    const outputText = extractOutputText(payload);

    if (!outputText) {
      return {
        enabled: true,
        used: false,
        provider: "none",
        model: null,
        evidence: null,
        fallbackReason: "vision_empty_response",
      };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      return {
        enabled: true,
        used: false,
        provider: "none",
        model: null,
        evidence: null,
        fallbackReason: "vision_invalid_json",
      };
    }

    const evidence = cleanEvidence(parsed);

    if (!evidence) {
      return {
        enabled: true,
        used: false,
        provider: "none",
        model: null,
        evidence: null,
        fallbackReason: "vision_invalid_evidence",
      };
    }

    return {
      enabled: true,
      used: true,
      provider: "openai",
      model,
      evidence,
      fallbackReason: null,
    };
  } catch {
    return {
      enabled: true,
      used: false,
      provider: "none",
      model: null,
      evidence: null,
      fallbackReason: "vision_request_failed",
    };
  }
}
