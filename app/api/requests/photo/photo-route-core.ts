import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import {
  detectCatalogServiceCandidates,
  mergeServiceCandidates,
  type CatalogServiceRecord,
} from "@/lib/catalog-service-matcher";
import {
  analyzePhotoDescription,
  type PhotoServiceAnalysis,
} from "@/lib/photo-service-analysis";
import {
  analyzePhotoVisualContent,
  isPhotoVisionEnabled,
  type PhotoVisionResult,
} from "@/lib/photo-vision-analysis";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_TYPES as readonly string[]).includes(value);
}

async function loadCanonicalServices(): Promise<CatalogServiceRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("slug, name")
    .limit(1000);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(
    (service): service is CatalogServiceRecord =>
      typeof service.slug === "string" &&
      service.slug.trim().length > 0 &&
      (service.name == null || typeof service.name === "string")
  );
}

function visionFallback(
  enabled: boolean,
  reason: string
): PhotoVisionResult {
  return {
    enabled,
    used: false,
    provider: "none",
    model: null,
    evidence: null,
    fallbackReason: reason,
  };
}

function buildAnalysis(params: {
  description: string;
  services: readonly CatalogServiceRecord[];
  vision: PhotoVisionResult;
}): PhotoServiceAnalysis & {
  analysisMode: "description_assisted" | "vision_ai";
  visionSummary: string | null;
  visionConfidence: number | null;
} {
  const descriptionAnalysis = analyzePhotoDescription(params.description);
  const textCatalogCandidates = detectCatalogServiceCandidates(
    params.description,
    params.services,
    3
  );
  const evidence = params.vision.evidence;
  const visualText = evidence
    ? [evidence.visualSummary, ...evidence.serviceHints].join(" ")
    : "";
  const visualCatalogCandidates = evidence
    ? detectCatalogServiceCandidates(
        visualText,
        params.services,
        3
      ).map((candidate) => ({
        ...candidate,
        confidence: Math.min(
          candidate.confidence,
          Math.max(60, evidence.confidence)
        ),
        reason:
          "Le contenu visuel de la photo correspond à ce métier dans le catalogue KLYX.",
      }))
    : [];
  const combinedLegacyAnalysis = evidence
    ? analyzePhotoDescription(
        `${params.description} ${visualText}`
      )
    : descriptionAnalysis;
  const candidates = mergeServiceCandidates(
    params.services,
    textCatalogCandidates,
    visualCatalogCandidates,
    descriptionAnalysis.candidates,
    combinedLegacyAnalysis.candidates
  );
  const best = candidates[0] ?? null;
  const analysisMode = params.vision.used
    ? "vision_ai"
    : "description_assisted";

  return {
    serviceSlug: best?.slug ?? null,
    serviceLabel: best?.label ?? null,
    candidates,
    summary: params.vision.used
      ? best
        ? `La photo et ta description semblent correspondre à un service de ${best.label.toLowerCase()}.`
        : "KLYX a analysé la photo et ta description, mais le service doit encore être précisé."
      : best
        ? `Ta description semble correspondre à un service de ${best.label.toLowerCase()}.`
        : descriptionAnalysis.summary,
    limitations: params.vision.used
      ? "KLYX a réellement analysé le contenu visuel de la photo. Cette analyse reste une aide au choix du métier, pas un diagnostic technique : vérifie le service avant de lancer la recherche."
      : params.vision.enabled
        ? "L’analyse visuelle IA était indisponible pour cette photo. KLYX a utilisé uniquement ta description écrite comme solution de repli."
        : "L’analyse visuelle IA est désactivée. KLYX utilise uniquement ta description écrite tant que la vision n’est pas activée.",
    analysisMode,
    visionSummary: evidence?.visualSummary ?? null,
    visionConfidence: evidence?.confidence ?? null,
  };
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const policy = API_RATE_LIMIT_POLICIES.photoAnalysis;
    const rateLimit = await consumeApiRateLimit(
      profile.id,
      policy
    );

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    const body = (await request.json()) as {
      storagePath?: unknown;
      originalName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
      width?: unknown;
      height?: unknown;
      description?: unknown;
    };

    const storagePath =
      typeof body.storagePath === "string"
        ? body.storagePath.trim()
        : "";
    const originalName =
      typeof body.originalName === "string"
        ? body.originalName.trim().slice(0, 255)
        : "";
    const mimeType =
      typeof body.mimeType === "string"
        ? body.mimeType.trim()
        : "";
    const sizeBytes = Number(body.sizeBytes);
    const width =
      body.width == null ? null : Number(body.width);
    const height =
      body.height == null ? null : Number(body.height);
    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 1500)
        : "";

    if (
      !storagePath.startsWith(`${profile.id}/`) ||
      storagePath.includes("..")
    ) {
      return NextResponse.json(
        { error: "Chemin de photo invalide." },
        {
          status: 400,
          headers: rateLimitResponseHeaders(policy, rateLimit),
        }
      );
    }

    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Utilise une image JPG, PNG ou WEBP.",
        },
        {
          status: 400,
          headers: rateLimitResponseHeaders(policy, rateLimit),
        }
      );
    }

    if (
      !Number.isFinite(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > 10 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          error:
            "La photo doit peser moins de 10 Mo.",
        },
        {
          status: 400,
          headers: rateLimitResponseHeaders(policy, rateLimit),
        }
      );
    }

    if (description.length < 10) {
      return NextResponse.json(
        {
          error:
            "Décris le problème avec au moins 10 caractères.",
        },
        {
          status: 400,
          headers: rateLimitResponseHeaders(policy, rateLimit),
        }
      );
    }

    const fileName = storagePath.split("/").pop();
    const [objectsResult, services] = await Promise.all([
      supabaseAdmin.storage
        .from("client-service-photos")
        .list(profile.id, {
          search: fileName,
          limit: 10,
        }),
      loadCanonicalServices(),
    ]);

    if (objectsResult.error) {
      throw new Error(objectsResult.error.message);
    }

    if (
      !fileName ||
      !objectsResult.data?.some(
        (object) => object.name === fileName
      )
    ) {
      return NextResponse.json(
        {
          error:
            "La photo envoyée est introuvable.",
        },
        {
          status: 409,
          headers: rateLimitResponseHeaders(policy, rateLimit),
        }
      );
    }

    const visionEnabled = isPhotoVisionEnabled();
    let vision = visionFallback(
      visionEnabled,
      visionEnabled ? "vision_not_attempted" : "vision_disabled"
    );

    if (visionEnabled) {
      const { data: imageBlob, error: downloadError } =
        await supabaseAdmin.storage
          .from("client-service-photos")
          .download(storagePath);

      if (downloadError || !imageBlob) {
        vision = visionFallback(
          true,
          "vision_storage_download_failed"
        );
      } else {
        const imageBytes = new Uint8Array(
          await imageBlob.arrayBuffer()
        );
        vision = await analyzePhotoVisualContent({
          bytes: imageBytes,
          mimeType,
          userDescription: description,
        });
      }
    }

    const analysis = buildAnalysis({
      description,
      services,
      vision,
    });

    const { data, error } = await supabaseAdmin
      .from("photo_service_requests")
      .insert({
        profile_id: profile.id,
        storage_path: storagePath,
        original_name: originalName || "photo",
        mime_type: mimeType,
        size_bytes: sizeBytes,
        width:
          typeof width === "number" &&
          Number.isInteger(width) &&
          width > 0
            ? width
            : null,
        height:
          typeof height === "number" &&
          Number.isInteger(height) &&
          height > 0
            ? height
            : null,
        user_description: description,
        detected_service_slug:
          analysis.serviceSlug,
        analysis_mode: analysis.analysisMode,
        analysis_payload: {
          ...analysis,
          vision: {
            enabled: vision.enabled,
            used: vision.used,
            provider: vision.provider,
            model: vision.model,
            fallbackReason: vision.fallbackReason,
          },
        },
        status: "analyzed",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(
      {
        requestId: data.id,
        analysis,
        analysisMode: analysis.analysisMode,
        visionUsed: vision.used,
      },
      {
        headers: rateLimitResponseHeaders(policy, rateLimit),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Analyse impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      requestId?: unknown;
    };

    const requestId =
      typeof body.requestId === "string"
        ? body.requestId.trim()
        : "";

    const { data: photoRequest, error } =
      await supabaseAdmin
        .from("photo_service_requests")
        .select("id, storage_path")
        .eq("id", requestId)
        .eq("profile_id", profile.id)
        .maybeSingle();

    if (error) throw new Error(error.message);

    if (!photoRequest) {
      return NextResponse.json(
        { error: "Demande photo introuvable." },
        { status: 404 }
      );
    }

    const { error: storageError } =
      await supabaseAdmin.storage
        .from("client-service-photos")
        .remove([photoRequest.storage_path]);

    if (storageError) {
      throw new Error(storageError.message);
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("photo_service_requests")
        .delete()
        .eq("id", photoRequest.id)
        .eq("profile_id", profile.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({
      message: "Photo supprimée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Suppression impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
