import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      documentId?: unknown;
    };

    const documentId =
      typeof body.documentId === "string"
        ? body.documentId.trim()
        : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Document manquant." },
        { status: 400 }
      );
    }

    const { data: document, error } = await supabaseAdmin
      .from("provider_verification_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable." },
        { status: 404 }
      );
    }

    const { data, error: signedError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .createSignedUrl(document.storage_path, 60);

    if (signedError) throw new Error(signedError.message);

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’ouvrir le document.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      documentId?: unknown;
    };

    const documentId =
      typeof body.documentId === "string"
        ? body.documentId.trim()
        : "";

    const { data: document, error } = await supabaseAdmin
      .from("provider_verification_documents")
      .select("id, document_type, storage_path, status")
      .eq("id", documentId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable." },
        { status: 404 }
      );
    }

    if (document.status === "approved") {
      return NextResponse.json(
        {
          error:
            "Un document approuvé ne peut plus être supprimé depuis cette page.",
        },
        { status: 409 }
      );
    }

    const { error: storageError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .remove([document.storage_path]);

    if (storageError) throw new Error(storageError.message);

    const { error: deleteError } = await supabaseAdmin
      .from("provider_verification_documents")
      .delete()
      .eq("id", document.id)
      .eq("profile_id", profile.id);

    if (deleteError) throw new Error(deleteError.message);

    const { count, error: countError } = await supabaseAdmin
      .from("provider_verification_documents")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("document_type", document.document_type);

    if (countError) throw new Error(countError.message);

    if ((count ?? 0) === 0) {
      const column =
        document.document_type === "identity"
          ? "identity_status"
          : document.document_type === "address"
            ? "address_status"
            : document.document_type === "business"
              ? "business_status"
              : document.document_type === "insurance"
                ? "insurance_status"
                : "professional_status";

      await supabaseAdmin
        .from("provider_verifications")
        .update({
          [column]:
            ["identity", "address"].includes(
              document.document_type
            )
              ? "missing"
              : "optional",
          status: "incomplete",
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id);
    }

    return NextResponse.json({
      message: "Document supprimé.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de supprimer le document.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
