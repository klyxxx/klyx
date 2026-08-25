import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { getPublicUserServiceQualificationIds } from "@/lib/provider-skill-publication";
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

    const eligibility = await getPublicUserServiceQualificationIds({
      profileId: providerId,
      userServiceIds: (data ?? []).map((row) => row.id as string),
    });

    return NextResponse.json({
      // Compatibility: existing public consumers read userServiceIds. It now
      // means live public eligibility, which correctly includes free
      // self-declared skills without pretending they were reviewed by KLYX.
      userServiceIds: Array.from(eligibility.eligibleUserServiceIds),
      approvedUserServiceIds: Array.from(
        eligibility.approvedUserServiceIds
      ),
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
