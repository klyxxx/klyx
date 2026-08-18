import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  evaluateSkillEvidence,
  getSkillQualificationRule,
} from "@/lib/skill-qualification";

const PROOF_TYPES = new Set([
  "diploma",
  "training_certificate",
  "professional_license",
  "insurance",
  "experience_reference",
  "portfolio",
  "other",
]);

const MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const SKILL_BAD_REQUEST_MESSAGES = new Set([
  "Métier manquant.",
  "Type de preuve invalide.",
  "Utilise un PDF, JPG, PNG ou WEBP.",
  "Le fichier doit faire moins de 10 Mo.",
  "Chemin de document invalide.",
  "L'expérience doit être comprise entre 0 et 80 ans.",
  "Explique en au moins 30 caractères pourquoi tu peux réaliser cette prestation.",
]);

const SKILL_CONFLICT_MESSAGES = new Set([
  "Le fichier envoyé est introuvable.",
  "Ce dossier est verrouillé pendant sa vérification.",
  "Ta vérification d'identité doit être validée avant l'envoi de cette compétence.",
]);

function skillVerificationErrorStatus(
  message: string
): number {
  const authStatus = apiErrorStatus(message);

  if (authStatus !== 500) return authStatus;

  if (message === "Métier prestataire introuvable.") {
    return 404;
  }

  if (
    SKILL_BAD_REQUEST_MESSAGES.has(message) ||
    message.startsWith("KLYX demande au moins ") ||
    message.startsWith("Preuves obligatoires manquantes :")
  ) {
    return 400;
  }

  if (SKILL_CONFLICT_MESSAGES.has(message)) {
    return 409;
  }

  return 500;
}

async function requireProvider(request: Request) {
  const result = await getAuthenticatedProfile(request);
  requireAccountType(result.profile, "provider");
  return result;
}

async function getOwnedUserService(
  profileId: string,
  userServiceId: string
) {
  const { data, error } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id, active, provider_enabled")
    .eq("id", userServiceId)
    .eq("user_id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    throw new Error("Métier prestataire introuvable.");
  }

  return data;
}

async function ensureVerification(
  profileId: string,
  userServiceId: string
) {
  const { data, error } = await supabaseAdmin
    .from("provider_skill_verifications")
    .upsert(
      {
        profile_id: profileId,
        user_service_id: userServiceId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id,user_service_id",
        ignoreDuplicates: false,
      }
    )
    .select(
      "id, profile_id, user_service_id, status, provider_statement, years_experience, submitted_at, reviewed_at, review_note, created_at, updated_at"
    )
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await requireProvider(request);

    const { data: userServices, error: userServicesError } =
      await supabaseAdmin
        .from("user_services")
        .select("id, service_id, active, provider_enabled")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: true });

    if (userServicesError) {
      throw new Error(userServicesError.message);
    }

    const serviceIds = Array.from(
      new Set(
        (userServices ?? []).map((item) => item.service_id)
      )
    );

    const { data: services, error: servicesError } =
      serviceIds.length > 0
        ? await supabaseAdmin
            .from("services")
            .select("id, name, slug")
            .in("id", serviceIds)
        : { data: [], error: null };

    if (servicesError) {
      throw new Error(servicesError.message);
    }

    const userServiceIds = (userServices ?? []).map(
      (item) => item.id
    );

    const { data: verifications, error: verificationError } =
      userServiceIds.length > 0
        ? await supabaseAdmin
            .from("provider_skill_verifications")
            .select(
              "id, profile_id, user_service_id, status, provider_statement, years_experience, submitted_at, reviewed_at, review_note, created_at, updated_at"
            )
            .eq("profile_id", profile.id)
            .in("user_service_id", userServiceIds)
        : { data: [], error: null };

    if (verificationError) {
      throw new Error(verificationError.message);
    }

    const verificationIds = (verifications ?? []).map(
      (item) => item.id
    );

    const { data: documents, error: documentsError } =
      verificationIds.length > 0
        ? await supabaseAdmin
            .from("provider_skill_documents")
            .select(
              "id, verification_id, profile_id, user_service_id, proof_type, original_name, mime_type, size_bytes, status, rejection_reason, uploaded_at"
            )
            .eq("profile_id", profile.id)
            .in("verification_id", verificationIds)
            .order("uploaded_at", { ascending: false })
        : { data: [], error: null };

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    const serviceById = new Map(
      (services ?? []).map((service) => [
        service.id,
        service,
      ])
    );

    const verificationByUserService = new Map(
      (verifications ?? []).map((verification) => [
        verification.user_service_id,
        verification,
      ])
    );

    return NextResponse.json({
      skills: (userServices ?? []).map((userService) => {
        const service =
          serviceById.get(userService.service_id) ?? null;
        const verification =
          verificationByUserService.get(userService.id) ?? null;

        return {
          userServiceId: userService.id,
          serviceId: userService.service_id,
          serviceName:
            service?.name ?? "Service KLYX",
          serviceSlug:
            service?.slug ?? "service",
          active: userService.active !== false,
          providerEnabled:
            userService.provider_enabled !== false,
          verification: verification
            ? {
                ...verification,
                documents: (documents ?? []).filter(
                  (document) =>
                    document.verification_id ===
                    verification.id
                ),
              }
            : null,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chargement impossible.";
    const status = skillVerificationErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "provider_skill_verification_read_failed",
      route: "/api/provider/skills-verification",
      method: "GET",
      status,
      code: "KLYX_PROVIDER_SKILL_VERIFICATION_READ_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await requireProvider(request);

    const body = (await request.json()) as {
      userServiceId?: string;
      proofType?: string;
      storagePath?: string;
      originalName?: string;
      mimeType?: string;
      sizeBytes?: number;
    };

    const userServiceId =
      body.userServiceId?.trim() ?? "";
    const proofType =
      body.proofType?.trim() ?? "";
    const storagePath =
      body.storagePath?.trim() ?? "";
    const originalName =
      body.originalName?.trim().slice(0, 255) ?? "";
    const mimeType =
      body.mimeType?.trim() ?? "";
    const sizeBytes = Number(body.sizeBytes ?? 0);

    if (!userServiceId) {
      throw new Error("Métier manquant.");
    }

    await getOwnedUserService(
      profile.id,
      userServiceId
    );

    if (!PROOF_TYPES.has(proofType)) {
      throw new Error("Type de preuve invalide.");
    }

    if (!MIME_TYPES.has(mimeType)) {
      throw new Error(
        "Utilise un PDF, JPG, PNG ou WEBP."
      );
    }

    if (
      !Number.isFinite(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > 10 * 1024 * 1024
    ) {
      throw new Error(
        "Le fichier doit faire moins de 10 Mo."
      );
    }

    const expectedPrefix =
      `${profile.id}/skills/${userServiceId}/`;

    if (
      !storagePath.startsWith(expectedPrefix)
    ) {
      throw new Error(
        "Chemin de document invalide."
      );
    }

    const parts = storagePath.split("/");
    const fileName = parts.pop() ?? "";
    const folder = parts.join("/");

    const { data: objects, error: listError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .list(folder, {
          search: fileName,
          limit: 10,
        });

    if (listError) {
      throw new Error(listError.message);
    }

    if (
      !objects?.some(
        (object) => object.name === fileName
      )
    ) {
      throw new Error(
        "Le fichier envoyé est introuvable."
      );
    }

    const verification =
      await ensureVerification(
        profile.id,
        userServiceId
      );

    if (
      ["submitted", "under_review", "approved"].includes(
        verification.status
      )
    ) {
      throw new Error(
        "Ce dossier est verrouillé pendant sa vérification."
      );
    }

    const { data: document, error: insertError } =
      await supabaseAdmin
        .from("provider_skill_documents")
        .insert({
          verification_id: verification.id,
          profile_id: profile.id,
          user_service_id: userServiceId,
          proof_type: proofType,
          original_name: originalName || fileName,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          status: "uploaded",
        })
        .select(
          "id, verification_id, user_service_id, proof_type, original_name, mime_type, size_bytes, status, rejection_reason, uploaded_at"
        )
        .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      document,
      message:
        "Preuve ajoutée à cette compétence.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Enregistrement impossible.";
    const status = skillVerificationErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "provider_skill_verification_document_register_failed",
      route: "/api/provider/skills-verification",
      method: "POST",
      status,
      code: "KLYX_PROVIDER_SKILL_VERIFICATION_DOCUMENT_REGISTER_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await requireProvider(request);

    const body = (await request.json()) as {
      userServiceId?: string;
      providerStatement?: string;
      yearsExperience?: number;
      submit?: boolean;
    };

    const userServiceId =
      body.userServiceId?.trim() ?? "";

    if (!userServiceId) {
      throw new Error("Métier manquant.");
    }

    await getOwnedUserService(
      profile.id,
      userServiceId
    );

    const verification =
      await ensureVerification(
        profile.id,
        userServiceId
      );

    if (
      ["submitted", "under_review", "approved"].includes(
        verification.status
      )
    ) {
      throw new Error(
        "Ce dossier est verrouillé pendant sa vérification."
      );
    }

    const statement =
      body.providerStatement?.trim().slice(0, 1200) ??
      "";

    const years = Number(
      body.yearsExperience ?? 0
    );

    if (
      !Number.isInteger(years) ||
      years < 0 ||
      years > 80
    ) {
      throw new Error(
        "L'expérience doit être comprise entre 0 et 80 ans."
      );
    }

    if (body.submit === true) {
      const { data: ownedService, error: ownedServiceError } =
        await supabaseAdmin
          .from("user_services")
          .select("id, service_id")
          .eq("id", userServiceId)
          .eq("user_id", profile.id)
          .single();

      if (ownedServiceError) throw new Error(ownedServiceError.message);

      const { data: service, error: serviceError } =
        await supabaseAdmin
          .from("services")
          .select("id, name, slug")
          .eq("id", ownedService.service_id)
          .single();

      if (serviceError) throw new Error(serviceError.message);

      const { data: documents, error: documentsError } =
        await supabaseAdmin
          .from("provider_skill_documents")
          .select("proof_type, status")
          .eq("verification_id", verification.id);

      if (documentsError) throw new Error(documentsError.message);

      const { data: generalVerification, error: generalError } =
        await supabaseAdmin
          .from("provider_verifications")
          .select("identity_status")
          .eq("profile_id", profile.id)
          .maybeSingle();

      if (generalError) throw new Error(generalError.message);

      const rule = await getSkillQualificationRule({
        countryCode: profile.countryCode,
        serviceSlug: service.slug,
      });

      const evaluation = evaluateSkillEvidence({
        rule,
        proofTypes: (documents ?? [])
          .filter((document) => document.status !== "rejected")
          .map((document) => document.proof_type),
        yearsExperience: years,
        identityApproved: generalVerification?.identity_status === "approved",
      });

      if (!evaluation.identityOk) {
        throw new Error("Ta vérification d'identité doit être validée avant l'envoi de cette compétence.");
      }

      if (!evaluation.experienceOk) {
        throw new Error(`KLYX demande au moins ${rule.minimumYearsExperience} année(s) d'expérience pour ce métier.`);
      }

      if (evaluation.missingProofTypes.length > 0) {
        throw new Error(`Preuves obligatoires manquantes : ${evaluation.missingProofTypes.join(", ")}.`);
      }

      if (statement.length < 30) {
        throw new Error("Explique en au moins 30 caractères pourquoi tu peux réaliser cette prestation.");
      }
    }

    const { data, error } = await supabaseAdmin
      .from("provider_skill_verifications")
      .update({
        provider_statement: statement,
        years_experience: years,
        status:
          body.submit === true
            ? "submitted"
            : verification.status ===
                "changes_required" ||
              verification.status ===
                "rejected"
              ? "not_started"
              : verification.status,
        submitted_at:
          body.submit === true
            ? new Date().toISOString()
            : verification.submitted_at,
        review_note:
          body.submit === true
            ? null
            : verification.review_note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id)
      .select(
        "id, profile_id, user_service_id, status, provider_statement, years_experience, submitted_at, reviewed_at, review_note, created_at, updated_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      verification: data,
      message:
        body.submit === true
          ? "Compétence envoyée à KLYX pour vérification."
          : "Informations enregistrées.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Mise à jour impossible.";
    const status = skillVerificationErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "provider_skill_verification_update_failed",
      route: "/api/provider/skills-verification",
      method: "PATCH",
      status,
      code: "KLYX_PROVIDER_SKILL_VERIFICATION_UPDATE_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

