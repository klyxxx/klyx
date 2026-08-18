import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

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
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_verification_document_open_failed",
      route: "/api/admin/verifications/document",
      method: "POST",
      status,
      code: "KLYX_ADMIN_VERIFICATION_DOCUMENT_OPEN_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}
