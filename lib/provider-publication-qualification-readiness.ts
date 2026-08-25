import { NextResponse } from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  evaluateSkillEvidence,
  getSkillQualificationRule,
} from "@/lib/skill-qualification";
import { skillQualificationRequiresApproval } from "@/lib/skill-qualification-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

type StudioPublicationBody = {
  publish?: unknown;
  services?: unknown;
};

type StudioServiceInput = {
  serviceId?: unknown;
  enabled?: unknown;
};

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ServiceRow = {
  id: string;
  name: string;
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

function enabledServiceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      (value as StudioServiceInput[])
        .filter((service) => service?.enabled === true)
        .map((service) =>
          typeof service?.serviceId === "string"
            ? service.serviceId.trim()
            : ""
        )
        .filter(Boolean)
    )
  );
}

export async function providerPublicationQualificationPreflight(
  request: Request
): Promise<Response | null> {
  const body = (await request.json()) as StudioPublicationBody;

  if (body.publish !== true) return null;

  const serviceIds = enabledServiceIds(body.services);
  if (serviceIds.length === 0) return null;

  const { profile } = await getAuthenticatedProfile(request);
  requireAccountType(profile, "provider");

  const countryCode = profile.countryCode.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json(
      {
        error:
          "Configure ton pays KLYX avant de publier tes services.",
        code: "KLYX_PROFILE_COUNTRY_REQUIRED",
      },
      { status: 409 }
    );
  }

  const { data: userServices, error: userServicesError } =
    await supabaseAdmin
      .from("user_services")
      .select("id, service_id")
      .eq("user_id", profile.id)
      .eq("provider_enabled", true)
      .in("service_id", serviceIds);

  if (userServicesError) throw new Error(userServicesError.message);

  const userServiceRows = (userServices ?? []) as UserServiceRow[];
  const userServiceByServiceId = new Map(
    userServiceRows.map((row) => [row.service_id, row])
  );

  if (
    serviceIds.some(
      (serviceId) => !userServiceByServiceId.has(serviceId)
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Enregistre d’abord tes services en brouillon avant de vérifier leurs qualifications.",
        code: "KLYX_PROVIDER_SERVICE_DRAFT_REQUIRED",
      },
      { status: 409 }
    );
  }

  const { data: services, error: servicesError } = await supabaseAdmin
    .from("services")
    .select("id, name, slug")
    .in("id", serviceIds);

  if (servicesError) throw new Error(servicesError.message);

  const serviceRows = (services ?? []) as ServiceRow[];
  const serviceById = new Map(
    serviceRows.map((service) => [service.id, service])
  );

  if (serviceIds.some((serviceId) => !serviceById.has(serviceId))) {
    return NextResponse.json(
      {
        error: "Un service KLYX sélectionné est introuvable.",
        code: "KLYX_PROVIDER_SERVICE_NOT_FOUND",
      },
      { status: 409 }
    );
  }

  const userServiceIds = serviceIds.map(
    (serviceId) =>
      (userServiceByServiceId.get(serviceId) as UserServiceRow).id
  );

  const { data: verifications, error: verificationsError } =
    await supabaseAdmin
      .from("provider_skill_verifications")
      .select("id, user_service_id, status, years_experience")
      .eq("profile_id", profile.id)
      .in("user_service_id", userServiceIds);

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
          .eq("profile_id", profile.id)
          .in("verification_id", verificationIds)
      : { data: [], error: null };

  if (documentsError) throw new Error(documentsError.message);

  const documentRows = (documents ?? []) as DocumentRow[];
  const { data: generalVerification, error: generalVerificationError } =
    await supabaseAdmin
      .from("provider_verifications")
      .select("identity_status")
      .eq("profile_id", profile.id)
      .maybeSingle();

  if (generalVerificationError) {
    throw new Error(generalVerificationError.message);
  }

  const blockedServices = [] as Array<{
    serviceId: string;
    serviceName: string;
    serviceSlug: string;
    ruleLevel: "self_declared" | "evidence_required" | "regulated";
    missingProofTypes: string[];
    experienceOk: boolean;
    identityOk: boolean;
    approvalRequired: boolean;
    approvalOk: boolean;
  }>;

  for (const serviceId of serviceIds) {
    const service = serviceById.get(serviceId) as ServiceRow;
    const userService = userServiceByServiceId.get(
      serviceId
    ) as UserServiceRow;
    const verification = verificationByUserServiceId.get(userService.id);
    const rule = await getSkillQualificationRule({
      countryCode,
      serviceSlug: service.slug,
    });
    const proofTypes = verification
      ? documentRows
          .filter(
            (document) =>
              document.verification_id === verification.id &&
              document.status !== "rejected"
          )
          .map((document) => document.proof_type)
      : [];
    const evaluation = evaluateSkillEvidence({
      rule,
      proofTypes,
      yearsExperience: Number(verification?.years_experience) || 0,
      identityApproved:
        generalVerification?.identity_status === "approved",
    });
    const approvalRequired = skillQualificationRequiresApproval(rule);
    const approvalOk =
      !approvalRequired || verification?.status === "approved";

    if (!evaluation.ready || !approvalOk) {
      blockedServices.push({
        serviceId,
        serviceName: service.name,
        serviceSlug: service.slug,
        ruleLevel: rule.ruleLevel,
        missingProofTypes: evaluation.missingProofTypes,
        experienceOk: evaluation.experienceOk,
        identityOk: evaluation.identityOk,
        approvalRequired,
        approvalOk,
      });
    }
  }

  if (blockedServices.length > 0) {
    return NextResponse.json(
      {
        error:
          "Complète et fais approuver les qualifications requises avant de publier ces services.",
        code: "KLYX_PROVIDER_SKILL_QUALIFICATION_REQUIRED",
        blockedServices,
      },
      { status: 409 }
    );
  }

  return null;
}
