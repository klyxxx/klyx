import "server-only";

import { apiErrorStatus, getAuthenticatedAccount } from "@/lib/api-auth";
import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RegisterBody = {
  installationId?: unknown;
  platform?: unknown;
  token?: unknown;
};

type UnregisterBody = {
  installationId?: unknown;
};

function normalizeInstallationId(value: unknown): string {
  const installationId = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(installationId)) {
    throw new Error("KLYX_MOBILE_PUSH_INSTALLATION_INVALID");
  }
  return installationId;
}

function normalizePlatform(value: unknown): "ios" | "android" {
  if (value === "ios" || value === "android") return value;
  throw new Error("KLYX_MOBILE_PUSH_PLATFORM_INVALID");
}

function normalizeToken(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  if (token.length < 16 || token.length > 8192) {
    throw new Error("KLYX_MOBILE_PUSH_TOKEN_INVALID");
  }
  return token;
}

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("KLYX_MOBILE_PUSH_")) return 400;
  return apiErrorStatus(message);
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    const { user, account } = await getAuthenticatedAccount(request);
    const body = (await request.json()) as RegisterBody;
    const installationId = normalizeInstallationId(body.installationId);
    const platform = normalizePlatform(body.platform);
    const token = normalizeToken(body.token);
    const now = new Date().toISOString();

    // A native token can be recycled after an app reinstall. Disable an older
    // active binding before claiming it for the authenticated installation.
    const { error: staleTokenError } = await supabaseAdmin
      .from("mobile_push_installations")
      .update({
        enabled: false,
        invalidated_at: now,
        updated_at: now,
      })
      .eq("platform", platform)
      .eq("native_token", token)
      .neq("installation_id", installationId)
      .eq("enabled", true);

    if (staleTokenError) throw staleTokenError;

    const { error } = await supabaseAdmin
      .from("mobile_push_installations")
      .upsert(
        {
          installation_id: installationId,
          account_id: account.id,
          auth_user_id: user.id,
          platform,
          native_token: token,
          enabled: true,
          invalidated_at: null,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "installation_id" }
      );

    if (error) throw error;

    return Response.json(
      { ok: true, installationId, platform },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = statusFor(error);
    logServerError({
      error,
      event: "mobile_push_installation_register_failed",
      route: "/api/mobile/push/installation",
      method: "POST",
      status,
      code:
        error instanceof Error
          ? error.message.slice(0, 120)
          : "KLYX_MOBILE_PUSH_REGISTER_FAILED",
      durationMs: Math.max(0, Date.now() - startedAt),
    });

    return Response.json(
      { ok: false, code: status === 401 ? "UNAUTHORIZED" : "REGISTER_FAILED" },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    const { account } = await getAuthenticatedAccount(request);
    const body = (await request.json()) as UnregisterBody;
    const installationId = normalizeInstallationId(body.installationId);
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("mobile_push_installations")
      .update({
        enabled: false,
        invalidated_at: now,
        updated_at: now,
      })
      .eq("installation_id", installationId)
      .eq("account_id", account.id);

    if (error) throw error;

    return Response.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = statusFor(error);
    logServerError({
      error,
      event: "mobile_push_installation_unregister_failed",
      route: "/api/mobile/push/installation",
      method: "DELETE",
      status,
      code:
        error instanceof Error
          ? error.message.slice(0, 120)
          : "KLYX_MOBILE_PUSH_UNREGISTER_FAILED",
      durationMs: Math.max(0, Date.now() - startedAt),
    });

    return Response.json(
      { ok: false, code: status === 401 ? "UNAUTHORIZED" : "UNREGISTER_FAILED" },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
