import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/mobile/notifications/read";

type Body = {
  profileId?: unknown;
  notificationId?: unknown;
  markAll?: unknown;
};

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profiles } = await getAuthenticatedProfile(request);
    const body = (await request.json().catch(() => null)) as Body | null;
    const profileId =
      typeof body?.profileId === "string" ? body.profileId.trim() : "";

    if (!profileId) {
      return NextResponse.json({ error: "Profil manquant." }, { status: 400 });
    }

    if (!profiles.some((item) => item.id === profileId)) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas." },
        { status: 403 }
      );
    }

    if (body?.markAll === true) {
      const { error } = await supabaseAdmin
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", profileId)
        .is("read_at", null);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    const notificationId =
      typeof body?.notificationId === "string"
        ? body.notificationId.trim()
        : "";

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification manquante." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", profileId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Notification indisponible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "mobile_notification_read_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_MOBILE_NOTIFICATION_READ_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
