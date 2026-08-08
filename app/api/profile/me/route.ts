import { NextResponse } from "next/server";

import { getActiveProfile } from "@/lib/active-profile";
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

    if (error) throw new Error(error.message);

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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger le profil.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const age = normalizeAge(body.age);

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

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json(
        { error: "Impossible de modifier ce profil." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d’enregistrer le profil.",
      },
      { status: 500 }
    );
  }
}
