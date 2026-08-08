import { NextResponse } from "next/server";
import {
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    await requireKlyxAdmin();

    const { data, error } =
      await supabaseAdmin
        .from("provider_verifications")
        .select(
          "id, profile_id, status, external_applicant_id, external_review_status, external_review_answer, external_reject_type, external_moderation_comment, external_sandbox_mode, external_updated_at"
        )
        .eq(
          "external_provider",
          "sumsub"
        )
        .order(
          "external_updated_at",
          {
            ascending: false,
            nullsFirst: false,
          }
        );

    if (error) {
      throw new Error(error.message);
    }

    const profileIds = Array.from(
      new Set(
        (data ?? []).map(
          (row) => row.profile_id
        )
      )
    );

    const { data: profiles, error: profileError } =
      profileIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select(
              "id, first_name, last_name"
            )
            .in("id", profileIds)
        : { data: [], error: null };

    if (profileError) {
      throw new Error(
        profileError.message
      );
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    return NextResponse.json({
      rows: (data ?? []).map((row) => {
        const profile =
          profileMap.get(
            row.profile_id
          );

        return {
          ...row,
          providerName:
            [
              profile?.first_name,
              profile?.last_name,
            ]
              .filter(Boolean)
              .join(" ") ||
            "Prestataire KLYX",
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chargement impossible.";

    return NextResponse.json(
      { error: message },
      { status: adminErrorStatus(error) }
    );
  }
}
