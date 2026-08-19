import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { getApprovedUserServiceIds } from "@/lib/provider-skill-publication";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();

  try {
    const { id: providerId } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", providerId)
      .eq("active", true)
      .eq("provider_enabled", true);

    if (error) {
      throw error;
    }

    const approved = await getApprovedUserServiceIds(
      (data ?? []).map((row) => row.id as string)
    );

    return NextResponse.json({
      userServiceIds: Array.from(approved),
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_public_verified_services_load_failed",
      route: "/api/providers/[id]/verified-services",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_PUBLIC_VERIFIED_SERVICES_LOAD_FAILED",
      startedAt,
    });
  }
}
