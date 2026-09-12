import { NextResponse } from "next/server";
import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  TRUST_SAFETY_ACTIVITY_FREQUENCIES,
  TRUST_SAFETY_LEGAL_PATHS,
  type TrustSafetyActivityFrequency,
  type TrustSafetyLegalPath,
} from "@/lib/trust-safety-authority";
import {
  getTrustSafetyAuthority,
  sanitizeTrustSafetyCategoryKey,
  updateTrustSafetyDeclarations,
} from "@/lib/trust-safety-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const url = new URL(request.url);
    const categoryKey = sanitizeTrustSafetyCategoryKey(
      url.searchParams.get("category") ?? "*"
    );
    const authority = await getTrustSafetyAuthority(profile, categoryKey);

    return NextResponse.json({
      authority,
      roleIndependent: true,
      legalClassificationAutomatic: false,
      sensitiveDecisionsHumanReviewable: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Trust & Safety authority.";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "trust_safety_authority_read_failed",
      route: "/api/trust-safety/authority",
      method: "GET",
      code: "KLYX_TRUST_SAFETY_AUTHORITY_READ_FAILED",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const body = (await request.json()) as {
      legalPath?: unknown;
      activityFrequency?: unknown;
      category?: unknown;
    };

    const legalPath =
      typeof body.legalPath === "string" ? body.legalPath.trim() : undefined;
    const activityFrequency =
      typeof body.activityFrequency === "string"
        ? body.activityFrequency.trim()
        : undefined;
    const categoryKey = sanitizeTrustSafetyCategoryKey(
      typeof body.category === "string" ? body.category : "*"
    );

    if (
      legalPath !== undefined &&
      !TRUST_SAFETY_LEGAL_PATHS.includes(legalPath as TrustSafetyLegalPath)
    ) {
      return NextResponse.json({ error: "Invalid legal pathway." }, { status: 400 });
    }

    if (
      activityFrequency !== undefined &&
      !TRUST_SAFETY_ACTIVITY_FREQUENCIES.includes(
        activityFrequency as TrustSafetyActivityFrequency
      )
    ) {
      return NextResponse.json({ error: "Invalid activity frequency." }, { status: 400 });
    }

    if (legalPath === undefined && activityFrequency === undefined) {
      return NextResponse.json(
        { error: "No declaration field was provided." },
        { status: 400 }
      );
    }

    await updateTrustSafetyDeclarations(profile, {
      legalPath: legalPath as TrustSafetyLegalPath | undefined,
      activityFrequency:
        activityFrequency as TrustSafetyActivityFrequency | undefined,
    });

    const authority = await getTrustSafetyAuthority(profile, categoryKey);
    return NextResponse.json({
      authority,
      message:
        "Declarations saved. Any prior human conclusion attached to changed facts was invalidated.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update Trust & Safety declarations.";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "trust_safety_authority_update_failed",
      route: "/api/trust-safety/authority",
      method: "PATCH",
      code: "KLYX_TRUST_SAFETY_AUTHORITY_UPDATE_FAILED",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
