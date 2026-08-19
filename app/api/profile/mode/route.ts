import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AccountMode = "client" | "provider";

export async function POST(request: Request) {
  const startedAt = Date.now();

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

    if (error) throw error;

    return NextResponse.json({
      currentMode: data.current_mode,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de changer de mode.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "profile_mode_update_failed",
      route: "/api/profile/mode",
      method: "POST",
      status,
      code: "KLYX_PROFILE_MODE_UPDATE_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
