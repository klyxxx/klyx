import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

type AccountMode = "client" | "provider";

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      mode?: AccountMode;
    };

    const mode = body.mode;

    if (mode !== "client" && mode !== "provider") {
      return NextResponse.json(
        { error: "Mode invalide." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        current_mode: mode,
      })
      .eq("id", profile.id)
      .select("current_mode")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      currentMode: data.current_mode,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de changer de mode.";

    const status = apiErrorStatus(message);

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
