import { NextResponse } from "next/server";

import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const AVATAR_BUCKET = "avatars";
const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const activeProfile = await getActiveProfile();

    if (!activeProfile) {
      return NextResponse.json(
        { error: "Profil KLYX actif introuvable." },
        { status: 404 }
      );
    }

    if (activeProfile.ownerUserId !== user.id) {
      return NextResponse.json(
        { error: "Accès au profil refusé." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image manquante." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Choisis une image JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "La photo doit faire 5 Mo maximum." },
        { status: 400 }
      );
    }

    const extension = extensionFor(file.type);
    const filePath = `${activeProfile.id}/avatar-${Date.now()}.${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    const { data, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeProfile.id)
      .eq("owner_user_id", user.id)
      .select("id")
      .maybeSingle();

    if (updateError || !data) {
      await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([filePath]);
      throw new Error(
        updateError?.message ?? "Impossible d’associer la photo au profil."
      );
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d’envoyer la photo.",
      },
      { status: 500 }
    );
  }
}
