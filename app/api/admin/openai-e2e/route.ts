import { deflateSync } from "node:zlib";

import { NextResponse } from "next/server";

import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { generateKlyxAiReply } from "@/lib/klyx-ai";
import { analyzePhotoVisualContent } from "@/lib/photo-vision-analysis";

export const runtime = "nodejs";

type ProbeChunkName = "IHDR" | "IDAT" | "IEND";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name: ProbeChunkName, payload: Uint8Array): Buffer {
  const type = Buffer.from(name, "ascii");
  const data = Buffer.from(payload);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);

  return Buffer.concat([length, type, data, checksum]);
}

function createSyntheticProbePng(): Uint8Array {
  const width = 32;
  const height = 32;
  const channels = 3;
  const rowLength = 1 + width * channels;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    raw[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * channels;
      const isBlueSquare = x >= 8 && x < 24 && y >= 8 && y < 24;

      raw[pixelOffset] = isBlueSquare ? 37 : 255;
      raw[pixelOffset + 1] = isBlueSquare ? 99 : 255;
      raw[pixelOffset + 2] = isBlueSquare ? 235 : 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function POST() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

    const assistant = await generateKlyxAiReply({
      message: [
        "Diagnostic synthétique KLYX.",
        "Réponds brièvement pour confirmer que le chemin conversationnel fonctionne.",
        "N'exécute aucune action et n'invente aucune donnée.",
      ].join(" "),
      accountType: "provider",
    });

    const vision = await analyzePhotoVisualContent({
      bytes: createSyntheticProbePng(),
      mimeType: "image/png",
      userDescription:
        "Image synthétique de diagnostic KLYX : un carré bleu sur fond blanc, sans personne ni donnée utilisateur.",
    });

    const assistantPassed = assistant.mode === "openai";
    const visionPassed =
      vision.enabled && vision.used && vision.provider === "openai";

    return NextResponse.json({
      ready: assistantPassed && visionPassed,
      assistant: {
        passed: assistantPassed,
        mode: assistant.mode,
      },
      vision: {
        passed: visionPassed,
        enabled: vision.enabled,
        used: vision.used,
        provider: vision.provider,
        model: vision.model,
        fallbackReason: vision.fallbackReason,
        confidence: vision.evidence?.confidence ?? null,
      },
      durationMs: Math.max(0, Date.now() - startedAt),
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_openai_e2e_probe_failed",
      route: "/api/admin/openai-e2e",
      method: "POST",
      status,
      code: "KLYX_ADMIN_OPENAI_E2E_PROBE_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
      details: {
        ready: false,
      },
    });
  }
}
