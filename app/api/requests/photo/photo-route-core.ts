import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { analyzePhotoDescription } from "@/lib/photo-service-analysis";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

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
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Utilise une image JPG, PNG ou WEBP.",
        },
        { status: 400 }
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
        { status: 400 }
      );
    }

    if (description.length < 10) {
      return NextResponse.json(
        {
          error:
            "Décris le problème avec au moins 10 caractères.",
        },
        { status: 400 }
      );
    }

    const fileName = storagePath.split("/").pop();

    const { data: objects, error: listError } =
      await supabaseAdmin.storage
        .from("client-service-photos")
        .list(profile.id, {
          search: fileName,
          limit: 10,
        });

    if (listError) {
      throw new Error(listError.message);
    }

    if (
      !fileName ||
      !objects?.some(
        (object) => object.name === fileName
      )
    ) {
      return NextResponse.json(
        {
          error:
            "La photo envoyée est introuvable.",
        },
        { status: 409 }
      );
    }

    const analysis =
      analyzePhotoDescription(description);

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
        analysis_mode: "description_assisted",
        analysis_payload: analysis,
        status: "analyzed",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      requestId: data.id,
      analysis,
    });
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
