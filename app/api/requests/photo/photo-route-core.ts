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
  PHOTO_VISION_MIN_RELIABLE_CONFIDENCE,
  type PhotoVisionResult,
} from "@/lib/photo-vision-analysis";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];

type PhotoAnalysisResult = PhotoServiceAnalysis & {
  analysisMode: "description_assisted" | "vision_ai";
  visionConfidence: number | null;
  visionContributed: boolean;
};

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_TYPES as readonly string[]).includes(value);
}

function hasExpectedImageSignature(
  bytes: Uint8Array,
  mimeType: AllowedMimeType
): boolean {
  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    const signature = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ];

    return (
      bytes.length >= signature.length &&
      signature.every((value, index) => bytes[index] === value)
    );
  }

  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
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
  visionRequested: boolean;
}): PhotoAnalysisResult {
  const descriptionAnalysis = analyzePhotoDescription(params.description);
  const textCatalogCandidates = detectCatalogServiceCandidates(
    params.description,
    params.services,
    3
  );
  const evidence = params.vision.evidence;
  const reliableVisualEvidence =
    evidence &&
    evidence.confidence >= PHOTO_VISION_MIN_RELIABLE_CONFIDENCE
      ? evidence
      : null;
  const visualText = reliableVisualEvidence
    ? [
        reliableVisualEvidence.visualSummary,
        ...reliableVisualEvidence.serviceHints,
      ].join(" ")
    : "";
  const visualCatalogCandidates = reliableVisualEvidence
    ? detectCatalogServiceCandidates(
        visualText,
        params.services,
        3
      ).map((candidate) => ({
        ...candidate,
        confidence: Math.min(
          candidate.confidence,
          reliableVisualEvidence.confidence
        ),
        reason:
          "Les indices visuels fiables de la photo correspondent à ce métier dans le catalogue KLYX.",
      }))
    : [];
  const candidates = mergeServiceCandidates(
    params.services,
    textCatalogCandidates,
    visualCatalogCandidates,
    descriptionAnalysis.candidates
  );
  const best = candidates[0] ?? null;
  const analysisMode = params.vision.used
    ? "vision_ai"
    : "description_assisted";
  const visionContributed = visualCatalogCandidates.length > 0;
  const visionConfidence = evidence?.confidence ?? null;

  let summary: string;

  if (params.vision.used && visionContributed) {
    summary = best
      ? `KLYX a réellement analysé la photo et ta description. Le besoin semble correspondre à un service de ${best.label.toLowerCase()}.`
      : "KLYX a réellement analysé la photo, mais le service doit encore être précisé.";
  } else if (
    params.vision.used &&
    visionConfidence != null &&
    visionConfidence < PHOTO_VISION_MIN_RELIABLE_CONFIDENCE
  ) {
    summary = best
      ? `KLYX a analysé la photo, mais les indices visuels sont trop incertains pour influencer le métier proposé. La suggestion ${best.label.toLowerCase()} repose sur ta description.`
      : "KLYX a analysé la photo, mais les indices visuels sont trop incertains pour choisir un métier. Précise ta description.";
  } else if (params.vision.used) {
    summary = best
      ? `KLYX a analysé la photo, mais aucun indice visuel fiable ne correspond encore au catalogue. La suggestion ${best.label.toLowerCase()} repose sur ta description.`
      : "KLYX a analysé la photo, mais aucun métier du catalogue ne peut être proposé avec assez de confiance.";
  } else if (best) {
    summary = `Ta description semble correspondre à un service de ${best.label.toLowerCase()}.`;
  } else {
    summary = descriptionAnalysis.summary;
  }

  let limitations: string;

  if (params.vision.used) {
    limitations =
      "Vision réelle utilisée. KLYX analyse uniquement les éléments utiles au service. Ce résultat reste une aide au choix du métier, jamais un diagnostic technique : vérifie le service avant de lancer la recherche.";
  } else if (!params.visionRequested) {
    limitations =
      "Tu n’as pas autorisé l’analyse visuelle IA pour cette photo. KLYX a utilisé uniquement ta description écrite.";
  } else if (params.vision.enabled) {
    limitations =
      "Tu as autorisé la vision, mais le moteur visuel était indisponible pour cette photo. KLYX a utilisé uniquement ta description écrite comme solution de repli.";
  } else {
    limitations =
      "Tu as autorisé la vision, mais elle n’est pas activée sur cet environnement KLYX. L’analyse repose uniquement sur ta description écrite.";
  }

  return {
    serviceSlug: best?.slug ?? null,
    serviceLabel: best?.label ?? null,
    candidates,
    summary,
    limitations,
    analysisMode,
    visionConfidence,
    visionContributed,
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
      useVision?: unknown;
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
    const visionRequested = body.useVision === true;

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
      visionRequested
        ? visionEnabled
          ? "vision_not_attempted"
          : "vision_disabled"
        : "vision_not_requested"
    );

    if (visionRequested && visionEnabled) {
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

        if (!hasExpectedImageSignature(imageBytes, mimeType)) {
          return NextResponse.json(
            {
              error:
                "Le contenu du fichier ne correspond pas au format image annoncé.",
            },
            {
              status: 400,
              headers: rateLimitResponseHeaders(policy, rateLimit),
            }
          );
        }

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
      visionRequested,
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
            requested: visionRequested,
            available: visionEnabled,
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
        visionRequested,
        visionAvailable: visionEnabled,
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
