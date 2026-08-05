import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

export async function POST(request: Request) {
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
        throw new Error(error.message);
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
      throw new Error(error.message);
    }

    return NextResponse.json({
      message: "Notification lue.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de mettre à jour la notification.";

    const status = apiErrorStatus(message);

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
