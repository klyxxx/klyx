import "server-only";

import { getSkillQualificationRule } from "@/lib/skill-qualification";
import { evaluateSkillPublicEligibility } from "@/lib/skill-qualification-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ProfileRow = {
  country_code: string | null;
};

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ServiceRow = {
  id: string;
  slug: string;
};

type VerificationRow = {
  id: string;
  user_service_id: string;
  status: string;
  years_experience: number | null;
};

type DocumentRow = {
  verification_id: string;
  proof_type: string;
  status: string;
};

export type PublicUserServiceQualificationIds = {
  eligibleUserServiceIds: Set<string>;
  approvedUserServiceIds: Set<string>;
};

function emptyPublicQualificationIds(): PublicUserServiceQualificationIds {
  return {
    eligibleUserServiceIds: new Set(),
    approvedUserServiceIds: new Set(),
  };
}

export async function getPublicUserServiceQualificationIds(params: {
  profileId: string;
  userServiceIds: string[];
}): Promise<PublicUserServiceQualificationIds> {
  const userServiceIds = Array.from(
    new Set(params.userServiceIds.map((id) => id.trim()).filter(Boolean))
  );

  if (userServiceIds.length === 0) {
    return emptyPublicQualificationIds();
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("country_code")
    .eq("id", params.profileId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const countryCode = ((profile as ProfileRow | null)?.country_code ?? "")
    .trim()
    .toUpperCase();

  // Public qualification is fail-closed when the provider no longer has a
  // valid market. Studio publication already requires the same country data.
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return emptyPublicQualificationIds();
  }

  const { data: userServices, error: userServicesError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", params.profileId)
    .in("id", userServiceIds);

  if (userServicesError) throw new Error(userServicesError.message);

  const userServiceRows = (userServices ?? []) as UserServiceRow[];
  if (userServiceRows.length === 0) {
    return emptyPublicQualificationIds();
  }

  const serviceIds = Array.from(
    new Set(userServiceRows.map((row) => row.service_id).filter(Boolean))
  );
  const { data: services, error: servicesError } = await supabaseAdmin
    .from("services")
    .select("id, slug")
    .in("id", serviceIds);

  if (servicesError) throw new Error(servicesError.message);

  const serviceRows = (services ?? []) as ServiceRow[];
  const serviceById = new Map(
    serviceRows.map((service) => [service.id, service])
  );

  const { data: verifications, error: verificationsError } =
    await supabaseAdmin
      .from("provider_skill_verifications")
      .select("id, user_service_id, status, years_experience")
      .eq("profile_id", params.profileId)
      .in(
        "user_service_id",
        userServiceRows.map((row) => row.id)
      );

  if (verificationsError) throw new Error(verificationsError.message);

  const verificationRows = (verifications ?? []) as VerificationRow[];
  const verificationByUserServiceId = new Map(
    verificationRows.map((verification) => [
      verification.user_service_id,
      verification,
    ])
  );
  const verificationIds = verificationRows.map(
    (verification) => verification.id
  );

  const { data: documents, error: documentsError } =
    verificationIds.length > 0
      ? await supabaseAdmin
          .from("provider_skill_documents")
          .select("verification_id, proof_type, status")
          .eq("profile_id", params.profileId)
          .in("verification_id", verificationIds)
      : { data: [], error: null };

  if (documentsError) throw new Error(documentsError.message);

  const documentRows = (documents ?? []) as DocumentRow[];
  const { data: generalVerification, error: generalVerificationError } =
    await supabaseAdmin
      .from("provider_verifications")
      .select("identity_status")
      .eq("profile_id", params.profileId)
      .maybeSingle();

  if (generalVerificationError) {
    throw new Error(generalVerificationError.message);
  }

  const rulesByServiceId = new Map(
    await Promise.all(
      serviceRows.map(async (service) => [
        service.id,
        await getSkillQualificationRule({
          countryCode,
          serviceSlug: service.slug,
        }),
      ] as const)
    )
  );
  const result = emptyPublicQualificationIds();

  for (const userService of userServiceRows) {
    const service = serviceById.get(userService.service_id);
    const rule = rulesByServiceId.get(userService.service_id);

    if (!service || !rule) continue;

    const verification = verificationByUserServiceId.get(userService.id);
    const proofTypes = verification
      ? documentRows
          .filter(
            (document) =>
              document.verification_id === verification.id &&
              document.status !== "rejected"
          )
          .map((document) => document.proof_type)
      : [];
    const evaluation = evaluateSkillPublicEligibility({
      rule,
      proofTypes,
      yearsExperience: Number(verification?.years_experience) || 0,
      identityApproved:
        generalVerification?.identity_status === "approved",
      verificationStatus: verification?.status ?? null,
    });

    if (evaluation.eligible) {
      result.eligibleUserServiceIds.add(userService.id);
    }

    if (evaluation.approved) {
      result.approvedUserServiceIds.add(userService.id);
    }
  }

  return result;
}

export async function getApprovedUserServiceIds(
  userServiceIds: string[]
): Promise<Set<string>> {
  const ids = Array.from(
    new Set(userServiceIds.map((id) => id.trim()).filter(Boolean))
  );

  if (ids.length === 0) return new Set();

  const { data, error } = await supabaseAdmin
    .from("provider_skill_verifications")
    .select("user_service_id")
    .in("user_service_id", ids)
    .eq("status", "approved");

  if (error) throw new Error(error.message);

  return new Set(
    (data ?? []).map((row) => row.user_service_id as string)
  );
}

export async function isUserServiceApproved(params: {
  profileId: string;
  userServiceId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("provider_skill_verifications")
    .select("id")
    .eq("profile_id", params.profileId)
    .eq("user_service_id", params.userServiceId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return Boolean(data);
}
