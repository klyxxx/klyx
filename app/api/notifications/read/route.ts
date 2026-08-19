import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (body.markAll) {
      const { error } = await supabaseAdmin
        .from("user_notifications")
        .update({
          read_at: new Date().toISOString(),
        })
        .eq("user_id", profile.id)
        .is("read_at", null);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        message: "Toutes les notifications ont été lues.",
      });
    }

    const notificationId = body.notificationId?.trim();

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification manquante." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", profile.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: "Notification lue.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "notification_read_update_failed",
      route: "/api/notifications/read",
      method: "POST",
      status,
      code: "KLYX_NOTIFICATION_READ_UPDATE_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
