import { NextResponse } from "next/server";
import {
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
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

    const { data, error } = await supabaseAdmin
      .from("provider_skill_documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json(
        { error: "Document introuvable." },
        { status: 404 }
      );
    }

    const { data: signed, error: signedError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .createSignedUrl(data.storage_path, 60);

    if (signedError) {
      throw new Error(signedError.message);
    }

    return NextResponse.json({
      url: signed.signedUrl,
      expiresIn: 60,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ouverture impossible.";

    return NextResponse.json(
      { error: message },
      { status: adminErrorStatus(error) }
    );
  }
}
