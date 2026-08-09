import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

const DOCUMENT_TYPES = [
  "identity",
  "address",
  "business",
  "insurance",
  "professional_certificate",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

function statusColumn(type: DocumentType): string {
  if (type === "identity") return "identity_status";
  if (type === "address") return "address_status";
  if (type === "business") return "business_status";
  if (type === "insurance") return "insurance_status";
  return "professional_status";
}

async function ensureVerification(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("provider_verifications")
    .upsert(
      {
        profile_id: profileId,
        status: "not_started",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id",
        ignoreDuplicates: true,
      }
    )
    .select(
      "id, profile_id, status, identity_status, address_status, business_status, insurance_status, professional_status, trust_level, submitted_at, reviewed_at, review_note, updated_at"
    )
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) return data;

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from("provider_verifications")
      .select(
        "id, profile_id, status, identity_status, address_status, business_status, insurance_status, professional_status, trust_level, submitted_at, reviewed_at, review_note, updated_at"
      )
      .eq("profile_id", profileId)
      .single();

  if (existingError) throw new Error(existingError.message);
  return existing;
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const verification = await ensureVerification(profile.id);

    const { data: documents, error } = await supabaseAdmin
      .from("provider_verification_documents")
      .select(
        "id, document_type, original_name, mime_type, size_bytes, status, rejection_reason, uploaded_at, reviewed_at"
      )
      .eq("profile_id", profile.id)
      .order("uploaded_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      verification,
      documents: documents ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger la vérification.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      documentType?: unknown;
      storagePath?: unknown;
      originalName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    };

    const documentType =
      typeof body.documentType === "string"
        ? body.documentType.trim()
        : "";
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

    if (!DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json(
        { error: "Type de document invalide." },
        { status: 400 }
      );
    }

    if (
      !storagePath.startsWith(`${profile.id}/`) ||
      storagePath.includes("..")
    ) {
      return NextResponse.json(
        { error: "Chemin de stockage invalide." },
        { status: 400 }
      );
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ].includes(mimeType)
    ) {
      return NextResponse.json(
        { error: "Format de document non autorisé." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > 10 * 1024 * 1024
    ) {
      return NextResponse.json(
        { error: "Le fichier doit peser moins de 10 Mo." },
        { status: 400 }
      );
    }

    const { data: objects, error: listError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .list(profile.id, {
          search: storagePath.split("/").pop(),
          limit: 10,
        });

    if (listError) throw new Error(listError.message);

    const expectedName = storagePath.split("/").pop();

    if (!objects?.some((object) => object.name === expectedName)) {
      return NextResponse.json(
        { error: "Le fichier envoyé est introuvable." },
        { status: 409 }
      );
    }

    const type = documentType as DocumentType;

    const { data: document, error: documentError } =
      await supabaseAdmin
        .from("provider_verification_documents")
        .insert({
          profile_id: profile.id,
          document_type: type,
          storage_path: storagePath,
          original_name: originalName || "document",
          mime_type: mimeType,
          size_bytes: sizeBytes,
          status: "uploaded",
        })
        .select(
          "id, document_type, original_name, mime_type, size_bytes, status, uploaded_at"
        )
        .single();

    if (documentError) throw new Error(documentError.message);

    const now = new Date().toISOString();
    const column = statusColumn(type);

    const { error: verificationError } = await supabaseAdmin
      .from("provider_verifications")
      .upsert(
        {
          profile_id: profile.id,
          status: "incomplete",
          [column]: "uploaded",
          updated_at: now,
        },
        {
          onConflict: "profile_id",
        }
      );

    if (verificationError) {
      throw new Error(verificationError.message);
    }

    return NextResponse.json({
      document,
      message: "Document enregistré de manière privée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer le document.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { data: verification, error: verificationError } =
      await supabaseAdmin
        .from("provider_verifications")
        .select(
          "identity_status, address_status, business_status, insurance_status, professional_status, status"
        )
        .eq("profile_id", profile.id)
        .maybeSingle();

    if (verificationError) {
      throw new Error(verificationError.message);
    }

    if (!verification) {
      return NextResponse.json(
        { error: "Commence par envoyer tes documents." },
        { status: 409 }
      );
    }

    if (
      verification.identity_status === "missing" ||
      verification.address_status === "missing"
    ) {
      return NextResponse.json(
        {
          error:
            "La pièce d’identité et le justificatif d’adresse sont obligatoires.",
        },
        { status: 409 }
      );
    }

    if (
      ["submitted", "under_review", "approved"].includes(
        verification.status
      )
    ) {
      return NextResponse.json(
        { error: "Le dossier est déjà envoyé ou traité." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("provider_verifications")
      .update({
        status: "submitted",
        identity_status: "under_review",
        address_status: "under_review",
        business_status:
          verification.business_status === "uploaded"
            ? "under_review"
            : verification.business_status,
        insurance_status:
          verification.insurance_status === "uploaded"
            ? "under_review"
            : verification.insurance_status,
        professional_status:
          verification.professional_status === "uploaded"
            ? "under_review"
            : verification.professional_status,
        submitted_at: now,
        updated_at: now,
      })
      .eq("profile_id", profile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      message:
        "Dossier envoyé. Les documents attendent maintenant une vérification.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’envoyer le dossier.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
