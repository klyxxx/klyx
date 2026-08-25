import "server-only";

import { getSkillQualificationRule } from "@/lib/skill-qualification";
import { evaluateSkillPublicEligibility } from "@/lib/skill-qualification-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ProfileRow = {
  id: string;
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
  profile_id: string;
  user_service_id: string;
  status: string;
  years_experience: number | null;
};

type DocumentRow = {
  verification_id: string;
  proof_type: string;
  status: string;
};

type GeneralVerificationRow = {
  profile_id: string;
  identity_status: string | null;
};

export type PublicUserServiceQualificationInput = {
  id: string;
  profileId: string;
  serviceId: string;
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

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function qualificationKey(countryCode: string, serviceSlug: string): string {
  return `${countryCode}|${serviceSlug}`;
}

function verificationKey(profileId: string, userServiceId: string): string {
  return `${profileId}|${userServiceId}`;
}

export async function getPublicUserServiceQualificationIdsForProfiles(params: {
  userServices: readonly PublicUserServiceQualificationInput[];
}): Promise<PublicUserServiceQualificationIds> {
  const uniqueUserServices = Array.from(
    new Map(
      params.userServices
        .map((item) => ({
          id: item.id.trim(),
          profileId: item.profileId.trim(),
          serviceId: item.serviceId.trim(),
        }))
        .filter((item) => item.id && item.profileId && item.serviceId)
        .map((item) => [item.id, item])
    ).values()
  );

  if (uniqueUserServices.length === 0) {
    return emptyPublicQualificationIds();
  }

  const profileIds = Array.from(
    new Set(uniqueUserServices.map((item) => item.profileId))
  );
  const serviceIds = Array.from(
    new Set(uniqueUserServices.map((item) => item.serviceId))
  );
  const userServiceIds = uniqueUserServices.map((item) => item.id);

  const [profilesResult, servicesResult, verificationsResult, generalResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, country_code")
        .in("id", profileIds),
      supabaseAdmin
        .from("services")
        .select("id, slug")
        .in("id", serviceIds),
      supabaseAdmin
        .from("provider_skill_verifications")
        .select("id, profile_id, user_service_id, status, years_experience")
        .in("profile_id", profileIds)
        .in("user_service_id", userServiceIds),
      supabaseAdmin
        .from("provider_verifications")
        .select("profile_id, identity_status")
        .in("profile_id", profileIds),
    ]);

  const firstError = [
    profilesResult.error,
    servicesResult.error,
    verificationsResult.error,
    generalResult.error,
  ].find(Boolean);

  if (firstError) throw new Error(firstError.message);

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const services = (servicesResult.data ?? []) as ServiceRow[];
  const verifications = (verificationsResult.data ?? []) as VerificationRow[];
  const generalVerifications =
    (generalResult.data ?? []) as GeneralVerificationRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const verificationByService = new Map(
    verifications.map((verification) => [
      verificationKey(verification.profile_id, verification.user_service_id),
      verification,
    ])
  );
  const identityStatusByProfile = new Map(
    generalVerifications.map((verification) => [
      verification.profile_id,
      verification.identity_status,
    ])
  );
  const verificationIds = verifications.map((verification) => verification.id);
  const { data: documents, error: documentsError } =
    verificationIds.length > 0
      ? await supabaseAdmin
          .from("provider_skill_documents")
          .select("verification_id, proof_type, status")
          .in("profile_id", profileIds)
          .in("verification_id", verificationIds)
      : { data: [], error: null };

  if (documentsError) throw new Error(documentsError.message);

  const documentRows = (documents ?? []) as DocumentRow[];
  const ruleRequests = new Map<
    string,
    { countryCode: string; serviceSlug: string }
  >();

  for (const userService of uniqueUserServices) {
    const countryCode = normalizeCountryCode(
      profileById.get(userService.profileId)?.country_code
    );
    const service = serviceById.get(userService.serviceId);

    if (!countryCode || !service?.slug) continue;

    ruleRequests.set(qualificationKey(countryCode, service.slug), {
      countryCode,
      serviceSlug: service.slug,
    });
  }

  const rulesByCountryAndService = new Map(
    await Promise.all(
      Array.from(ruleRequests.entries()).map(async ([key, request]) => [
        key,
        await getSkillQualificationRule(request),
      ] as const)
    )
  );
  const result = emptyPublicQualificationIds();

  for (const userService of uniqueUserServices) {
    const countryCode = normalizeCountryCode(
      profileById.get(userService.profileId)?.country_code
    );
    const service = serviceById.get(userService.serviceId);

    // Public qualification is fail-closed when the provider no longer has a
    // valid market or the referenced service disappeared.
    if (!countryCode || !service?.slug) continue;

    const rule = rulesByCountryAndService.get(
      qualificationKey(countryCode, service.slug)
    );

    if (!rule) continue;

    const verification = verificationByService.get(
      verificationKey(userService.profileId, userService.id)
    );
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
        identityStatusByProfile.get(userService.profileId) === "approved",
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

export async function getPublicUserServiceQualificationIds(params: {
  profileId: string;
  userServiceIds: string[];
}): Promise<PublicUserServiceQualificationIds> {
  const userServiceIds = Array.from(
    new Set(params.userServiceIds.map((id) => id.trim()).filter(Boolean))
  );
  const profileId = params.profileId.trim();

  if (!profileId || userServiceIds.length === 0) {
    return emptyPublicQualificationIds();
  }

  const { data: userServices, error: userServicesError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", profileId)
    .in("id", userServiceIds);

  if (userServicesError) throw new Error(userServicesError.message);

  const userServiceRows = (userServices ?? []) as UserServiceRow[];

  return getPublicUserServiceQualificationIdsForProfiles({
    userServices: userServiceRows.map((userService) => ({
      id: userService.id,
      profileId,
      serviceId: userService.service_id,
    })),
  });
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
