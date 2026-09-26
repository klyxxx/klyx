import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    const { data, error } = await supabaseAdmin
      .from("user_notifications")
      .select("id, type, title, message, href, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const notifications = (data ?? []).map((row) => ({
      id: row.id,
      type: row.type ?? null,
      title: row.title ?? null,
      message: row.message ?? null,
      href: row.href ?? null,
      readAt: row.read_at ?? null,
      createdAt: row.created_at,
    }));

    return NextResponse.json(
      { notifications },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chargement des notifications impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "mobile_notifications_load_failed",
      route: "/api/mobile/notifications",
      method: "GET",
      status,
      code: "KLYX_MOBILE_NOTIFICATIONS_LOAD_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
