import { NextRequest, NextResponse } from "next/server";

import { getActiveProfile, type ActiveProfile } from "@/lib/active-profile";
import {
  PROVIDER_ACTIVITY_FREQUENCIES,
  PROVIDER_DECLARATION_STATES,
  PROVIDER_LEGAL_PATHS,
  PROVIDER_SELF_EMPLOYMENT_CAPACITIES,
  PROVIDER_STUDENT_CONTEXTS,
} from "@/lib/provider-legal-authority";
import {
  getProviderLegalAuthority,
  updateProviderLegalDeclarations,
  type ProviderLegalDeclarationPatch,
} from "@/lib/provider-legal-authority-server";
import { createClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireProviderProfile(): Promise<ActiveProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  const profile = await getActiveProfile();
  if (!profile || profile.accountType !== "provider") {
    throw new Error("PROVIDER_PROFILE_REQUIRED");
  }

  return profile;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function parseDeclarationPatch(body: unknown): ProviderLegalDeclarationPatch {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_BODY");
  }

  const source = body as Record<string, unknown>;
  const patch: ProviderLegalDeclarationPatch = {};

  if ("path" in source) {
    if (!oneOf(source.path, PROVIDER_LEGAL_PATHS)) throw new Error("INVALID_PATH");
    patch.path = source.path;
  }

  if ("studentContext" in source) {
    if (!oneOf(source.studentContext, PROVIDER_STUDENT_CONTEXTS)) {
      throw new Error("INVALID_STUDENT_CONTEXT");
    }
    patch.studentContext = source.studentContext;
  }

  if ("activityFrequency" in source) {
    if (!oneOf(source.activityFrequency, PROVIDER_ACTIVITY_FREQUENCIES)) {
      throw new Error("INVALID_ACTIVITY_FREQUENCY");
    }
    patch.activityFrequency = source.activityFrequency;
  }

  if ("selfEmploymentCapacity" in source) {
    if (
      !oneOf(
        source.selfEmploymentCapacity,
        PROVIDER_SELF_EMPLOYMENT_CAPACITIES
      )
    ) {
      throw new Error("INVALID_SELF_EMPLOYMENT_CAPACITY");
    }
    patch.selfEmploymentCapacity = source.selfEmploymentCapacity;
  }

  if ("enterpriseNumber" in source) {
    if (source.enterpriseNumber === null) {
      patch.enterpriseNumber = null;
    } else if (typeof source.enterpriseNumber === "string") {
      const normalized = source.enterpriseNumber.trim().slice(0, 40);
      patch.enterpriseNumber = normalized || null;
    } else {
      throw new Error("INVALID_ENTERPRISE_NUMBER");
    }
  }

  if ("socialInsuranceFundAffiliation" in source) {
    if (
      !oneOf(
        source.socialInsuranceFundAffiliation,
        PROVIDER_DECLARATION_STATES
      )
    ) {
      throw new Error("INVALID_SOCIAL_INSURANCE_FUND_AFFILIATION");
    }
    patch.socialInsuranceFundAffiliation = source.socialInsuranceFundAffiliation;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("EMPTY_PATCH");
  }

  return patch;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

  if (message === "UNAUTHENTICATED") return jsonError("Non connecté.", 401);
  if (message === "PROVIDER_PROFILE_REQUIRED") {
    return jsonError("Active un profil prestataire pour continuer.", 403);
  }
  if (
    message.startsWith("INVALID_") ||
    message === "EMPTY_PATCH"
  ) {
    return jsonError("Données de parcours prestataire invalides.", 400);
  }

  console.error("[provider/legal-authority]", error);
  return jsonError("Impossible de charger le parcours prestataire.", 500);
}

export async function GET() {
  try {
    const profile = await requireProviderProfile();
    const authority = await getProviderLegalAuthority(profile);
    return NextResponse.json({ authority });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await requireProviderProfile();
    const body = await request.json().catch(() => null);
    const patch = parseDeclarationPatch(body);
    const authority = await updateProviderLegalDeclarations(profile, patch);
    return NextResponse.json({ authority });
  } catch (error) {
    return errorResponse(error);
  }
}
