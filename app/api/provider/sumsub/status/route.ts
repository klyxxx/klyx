import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { sumsubConfigured } from "@/lib/sumsub";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(
      profile,
      "provider"
    );

    const { data, error } =
      await supabaseAdmin
        .from("provider_verifications")
        .select(
          "status, identity_status, address_status, trust_level, external_provider, external_applicant_id, external_review_status, external_review_answer, external_reject_type, external_moderation_comment, external_sandbox_mode, external_updated_at"
        )
        .eq("profile_id", profile.id)
        .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      configured: sumsubConfigured(),
      verification: data ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chargement impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
