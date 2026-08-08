import { NextResponse } from "next/server";
import { apiErrorStatus, getAuthenticatedProfile, requireAccountType } from "@/lib/api-auth";
import { evaluateSkillEvidence, getSkillQualificationRule } from "@/lib/skill-qualification";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const userServiceId = new URL(request.url).searchParams.get("userServiceId")?.trim() ?? "";
    if (!userServiceId) return NextResponse.json({ error: "Métier manquant." }, { status: 400 });

    const { data: userService, error: usError } = await supabaseAdmin
      .from("user_services").select("id,service_id")
      .eq("id", userServiceId).eq("user_id", profile.id).maybeSingle();
    if (usError) throw new Error(usError.message);
    if (!userService) return NextResponse.json({ error: "Métier introuvable." }, { status: 404 });

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services").select("id,name,slug").eq("id", userService.service_id).single();
    if (serviceError) throw new Error(serviceError.message);

    const rule = await getSkillQualificationRule({
      countryCode: profile.countryCode,
      serviceSlug: service.slug,
    });

    const { data: verification, error: verificationError } = await supabaseAdmin
      .from("provider_skill_verifications").select("id,years_experience,status")
      .eq("profile_id", profile.id).eq("user_service_id", userServiceId).maybeSingle();
    if (verificationError) throw new Error(verificationError.message);

    const { data: documents, error: docsError } = verification
      ? await supabaseAdmin.from("provider_skill_documents").select("proof_type,status").eq("verification_id", verification.id)
      : { data: [], error: null };
    if (docsError) throw new Error(docsError.message);

    const { data: generalVerification, error: generalError } = await supabaseAdmin
      .from("provider_verifications").select("identity_status").eq("profile_id", profile.id).maybeSingle();
    if (generalError) throw new Error(generalError.message);

    return NextResponse.json({
      service,
      rule,
      evaluation: evaluateSkillEvidence({
        rule,
        proofTypes: (documents ?? []).filter((d) => d.status !== "rejected").map((d) => d.proof_type),
        yearsExperience: Number(verification?.years_experience) || 0,
        identityApproved: generalVerification?.identity_status === "approved",
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chargement impossible.";
    return NextResponse.json({ error: message }, { status: apiErrorStatus(message) });
  }
}

