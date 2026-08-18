import { NextResponse } from "next/server";
import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

    const { data: verifications, error } =
      await supabaseAdmin
        .from("provider_skill_verifications")
        .select(
          "id, profile_id, user_service_id, status, provider_statement, years_experience, submitted_at, reviewed_at, review_note, created_at, updated_at"
        )
        .order("submitted_at", {
          ascending: false,
          nullsFirst: false,
        });

    if (error) throw new Error(error.message);

    const profileIds = Array.from(
      new Set((verifications ?? []).map((row) => row.profile_id))
    );
    const userServiceIds = Array.from(
      new Set((verifications ?? []).map((row) => row.user_service_id))
    );

    const [
      { data: profiles, error: profilesError },
      { data: userServices, error: userServicesError },
      { data: documents, error: documentsError },
    ] = await Promise.all([
      profileIds.length > 0
        ? supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name, city")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      userServiceIds.length > 0
        ? supabaseAdmin
            .from("user_services")
            .select("id, service_id")
            .in("id", userServiceIds)
        : Promise.resolve({ data: [], error: null }),
      (verifications ?? []).length > 0
        ? supabaseAdmin
            .from("provider_skill_documents")
            .select(
              "id, verification_id, proof_type, original_name, mime_type, size_bytes, status, rejection_reason, uploaded_at"
            )
            .in(
              "verification_id",
              (verifications ?? []).map((row) => row.id)
            )
            .order("uploaded_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (userServicesError) throw new Error(userServicesError.message);
    if (documentsError) throw new Error(documentsError.message);

    const serviceIds = Array.from(
      new Set((userServices ?? []).map((row) => row.service_id))
    );

    const { data: services, error: servicesError } =
      serviceIds.length > 0
        ? await supabaseAdmin
            .from("services")
            .select("id, name, slug")
            .in("id", serviceIds)
        : { data: [], error: null };

    if (servicesError) throw new Error(servicesError.message);

    const profileMap = new Map(
      (profiles ?? []).map((row) => [row.id, row])
    );
    const userServiceMap = new Map(
      (userServices ?? []).map((row) => [row.id, row])
    );
    const serviceMap = new Map(
      (services ?? []).map((row) => [row.id, row])
    );

    return NextResponse.json({
      decisionAuthority: {
        mode: "external_verifier",
        provider: "sumsub_planned",
        adminRole: "observer",
      },
      verifications: (verifications ?? []).map((verification) => {
        const profile = profileMap.get(verification.profile_id);
        const userService = userServiceMap.get(
          verification.user_service_id
        );
        const service = userService
          ? serviceMap.get(userService.service_id)
          : null;

        return {
          ...verification,
          providerName:
            [profile?.first_name, profile?.last_name]
              .filter(Boolean)
              .join(" ") || "Prestataire KLYX",
          providerCity: profile?.city ?? "",
          serviceName: service?.name ?? "Service KLYX",
          serviceSlug: service?.slug ?? "service",
          documents: (documents ?? []).filter(
            (document) =>
              document.verification_id === verification.id
          ),
        };
      }),
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_skill_verifications_read_failed",
      route: "/api/admin/skill-verifications",
      method: "GET",
      status,
      code: "KLYX_ADMIN_SKILL_VERIFICATIONS_READ_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}
