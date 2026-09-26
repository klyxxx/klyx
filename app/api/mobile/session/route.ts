import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";

type MobileSessionBody = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

const MAX_TOKEN_LENGTH = 16_384;

function token(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 40_000) {
      return NextResponse.json(
        { error: "Requête trop volumineuse.", code: "KLYX_MOBILE_SESSION_TOO_LARGE" },
        { status: 413 }
      );
    }

    let body: MobileSessionBody;
    try {
      body = (await request.json()) as MobileSessionBody;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide.", code: "KLYX_MOBILE_SESSION_INVALID_JSON" },
        { status: 400 }
      );
    }

    const accessToken = token(body.accessToken);
    const refreshToken = token(body.refreshToken);

    if (
      !accessToken ||
      !refreshToken ||
      accessToken.length > MAX_TOKEN_LENGTH ||
      refreshToken.length > MAX_TOKEN_LENGTH
    ) {
      return NextResponse.json(
        { error: "Session invalide.", code: "KLYX_MOBILE_SESSION_INVALID" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data.user || !data.session) {
      return NextResponse.json(
        { error: "Session invalide.", code: "KLYX_MOBILE_SESSION_REJECTED" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        userId: data.user.id,
        expiresAt: data.session.expires_at ?? null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "mobile_session_bridge_failed",
      route: "/api/mobile/session",
      method: "POST",
      status: 500,
      code: "KLYX_MOBILE_SESSION_BRIDGE_FAILED",
      startedAt,
    });
  }
}

export async function DELETE() {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "mobile_session_signout_failed",
      route: "/api/mobile/session",
      method: "DELETE",
      status: 500,
      code: "KLYX_MOBILE_SESSION_SIGNOUT_FAILED",
      startedAt,
    });
  }
}
