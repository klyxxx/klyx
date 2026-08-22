import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  analyzePhotoVisualContent,
  isPhotoVisionEnabled,
  PHOTO_VISION_MIN_RELIABLE_CONFIDENCE,
} from "@/lib/photo-vision-analysis";

const previousVisionEnabled = process.env.KLYX_VISION_ENABLED;
const previousApiKey = process.env.OPENAI_API_KEY;
const previousVisionModel = process.env.KLYX_VISION_MODEL;
const previousOpenAiModel = process.env.KLYX_OPENAI_MODEL;

function restoreEnvironment() {
  for (const [name, value] of Object.entries({
    KLYX_VISION_ENABLED: previousVisionEnabled,
    OPENAI_API_KEY: previousApiKey,
    KLYX_VISION_MODEL: previousVisionModel,
    KLYX_OPENAI_MODEL: previousOpenAiModel,
  })) {
    if (value == null) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

describe("KLYX photo visual analysis runtime", () => {
  beforeEach(() => {
    process.env.KLYX_VISION_ENABLED = "1";
    process.env.OPENAI_API_KEY = "unit-test-key";
    process.env.KLYX_VISION_MODEL = "unit-test-vision-model";
    delete process.env.KLYX_OPENAI_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnvironment();
  });

  it("keeps the reliable visual-evidence boundary explicit", () => {
    expect(PHOTO_VISION_MIN_RELIABLE_CONFIDENCE).toBe(60);
    expect(isPhotoVisionEnabled()).toBe(true);
  });

  it("sends image input with no storage and parses structured visual evidence", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedInit = init;

        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              visualSummary:
                "Un robinet et une zone humide sont visibles sous un évier.",
              serviceHints: ["plomberie", "fuite robinet"],
              confidence: 82,
            }),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );

    const result = await analyzePhotoVisualContent({
      bytes: new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
      mimeType: "image/png",
      userDescription: "Le robinet fuit sous l’évier.",
    });

    expect(result).toEqual({
      enabled: true,
      used: true,
      provider: "openai",
      model: "unit-test-vision-model",
      evidence: {
        visualSummary:
          "Un robinet et une zone humide sont visibles sous un évier.",
        serviceHints: ["plomberie", "fuite robinet"],
        confidence: 82,
      },
      fallbackReason: null,
    });

    expect(capturedUrl).toBe("https://api.openai.com/v1/responses");
    expect(capturedInit?.method).toBe("POST");

    const body = JSON.parse(String(capturedInit?.body)) as {
      model: string;
      store: boolean;
      instructions: string;
      input: Array<{
        content: Array<Record<string, unknown>>;
      }>;
      text: {
        format: {
          type: string;
          strict: boolean;
        };
      };
    };

    expect(body.model).toBe("unit-test-vision-model");
    expect(body.store).toBe(false);
    expect(body.instructions).toContain("N'identifie jamais une personne");
    expect(body.instructions).toContain("caractéristique personnelle sensible");
    expect(body.instructions).toContain("diagnostic technique");
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      strict: true,
    });

    const imagePart = body.input[0].content.find(
      (part) => part.type === "input_image"
    );

    expect(imagePart).toMatchObject({
      type: "input_image",
      detail: "low",
    });
    expect(String(imagePart?.image_url)).toMatch(
      /^data:image\/png;base64,/
    );
  });

  it("falls back safely when external vision is disabled", async () => {
    process.env.KLYX_VISION_ENABLED = "0";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzePhotoVisualContent({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mimeType: "image/png",
      userDescription: "Une fuite est visible sous le robinet.",
    });

    expect(result.used).toBe(false);
    expect(result.provider).toBe("none");
    expect(result.fallbackReason).toBe("vision_disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed to the description fallback on invalid provider output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ output_text: "not-json" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const result = await analyzePhotoVisualContent({
      bytes: new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
      mimeType: "image/png",
      userDescription: "Une fuite est visible sous le robinet.",
    });

    expect(result.used).toBe(false);
    expect(result.evidence).toBeNull();
    expect(result.fallbackReason).toBe("vision_invalid_json");
  });
});
