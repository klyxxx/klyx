// KLYX_SKILL_COUNTRY_DYNAMIC_PHASE_5G
﻿import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  evaluateSkillEvidence,
  getSkillQualificationRule,
} from "@/lib/skill-qualification";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const userServiceId =
      new URL(request.url).searchParams
        .get("userServiceId")
        ?.trim() ?? "";

    if (!userServiceId) {
      return NextResponse.json(
        {
          error: "Métier manquant.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: userService,
      error: userServiceError,
    } = await supabaseAdmin
      .from("user_services")
      .select("id, service_id")
      .eq("id", userServiceId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (userServiceError) {
      throw new Error(
        userServiceError.message
      );
    }

    if (!userService) {
      return NextResponse.json(
        {
          error: "Métier introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: service,
      error: serviceError,
    } = await supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .eq(
        "id",
        userService.service_id
      )
      .single();

    if (serviceError) {
      throw new Error(
        serviceError.message
      );
    }

    const countryCode =
      profile.countryCode
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(
        countryCode
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Configure ton pays KLYX avant de vérifier les exigences métier.",
          code:
            "KLYX_PROFILE_COUNTRY_REQUIRED",
        },
        {
          status: 409,
        }
      );
    }

    const rule =
      await getSkillQualificationRule({
        countryCode,
        serviceSlug: service.slug,
      });

    const {
      data: verification,
      error: verificationError,
    } = await supabaseAdmin
      .from(
        "provider_skill_verifications"
      )
      .select(
        "id, years_experience, status"
      )
      .eq("profile_id", profile.id)
      .eq(
        "user_service_id",
        userServiceId
      )
      .maybeSingle();

    if (verificationError) {
      throw new Error(
        verificationError.message
      );
    }

    const {
      data: documents,
      error: documentsError,
    } = verification
      ? await supabaseAdmin
          .from(
            "provider_skill_documents"
          )
          .select(
            "proof_type, status"
          )
          .eq(
            "verification_id",
            verification.id
          )
      : {
          data: [],
          error: null,
        };

    if (documentsError) {
      throw new Error(
        documentsError.message
      );
    }

    const {
      data: generalVerification,
      error: generalVerificationError,
    } = await supabaseAdmin
      .from("provider_verifications")
      .select("identity_status")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (generalVerificationError) {
      throw new Error(
        generalVerificationError.message
      );
    }

    const evaluation =
      evaluateSkillEvidence({
        rule,
        proofTypes: (
          documents ?? []
        )
          .filter(
            (document) =>
              document.status !==
              "rejected"
          )
          .map(
            (document) =>
              document.proof_type
          ),
        yearsExperience:
          Number(
            verification?.years_experience
          ) || 0,
        identityApproved:
          generalVerification
            ?.identity_status ===
          "approved",
      });

    return NextResponse.json({
      service,
      rule,
      evaluation,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chargement impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "provider_skill_requirements_failed",
      route: "/api/provider/skill-requirements",
      method: "GET",
      status,
      code: "KLYX_PROVIDER_SKILL_REQUIREMENTS_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
