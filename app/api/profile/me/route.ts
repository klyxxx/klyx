import { NextResponse } from "next/server";

import { getActiveProfile } from "@/lib/active-profile";
import { secureApiErrorResponse } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UpdateBody = {
  firstName?: unknown;
  lastName?: unknown;
  city?: unknown;
  age?: unknown;
};

function normalizeAge(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const age = Number(value);

  if (!Number.isInteger(age) || age < 18 || age > 100) {
    throw new Error("L’âge doit être compris entre 18 et 100 ans.");
  }

  return age;
}

async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const user = await getSessionUser();

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

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, age, city, avatar_url, account_type")
      .eq("id", activeProfile.id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Profil KLYX introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profile: {
        id: data.id,
        firstName: data.first_name ?? "",
        lastName: data.last_name ?? "",
        age: typeof data.age === "number" ? data.age : null,
        city: data.city ?? "",
        avatarUrl: data.avatar_url ?? null,
        accountType: data.account_type === "provider" ? "provider" : "client",
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profile_read_failed",
      route: "/api/profile/me",
      method: "GET",
      status: 500,
      code: "KLYX_PROFILE_READ_FAILED",
      startedAt,
    });
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const user = await getSessionUser();

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

    const body = (await request.json()) as UpdateBody;

    const firstName =
      typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName =
      typeof body.lastName === "string" ? body.lastName.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";

    if (!firstName || !lastName || !city) {
      return NextResponse.json(
        { error: "Le prénom, le nom et la ville sont obligatoires." },
        { status: 400 }
      );
    }

    let age: number | null;

    try {
      age = normalizeAge(body.age);
    } catch {
      return NextResponse.json(
        { error: "L’âge doit être compris entre 18 et 100 ans." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        age,
        city,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeProfile.id)
      .eq("owner_user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Impossible de modifier ce profil." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profile_update_failed",
      route: "/api/profile/me",
      method: "PATCH",
      status: 500,
      code: "KLYX_PROFILE_UPDATE_FAILED",
      startedAt,
    });
  }
}
