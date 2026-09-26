import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  getKlyxFinancialLiveAuthority,
  type KlyxFinancialLiveState,
} from "@/lib/financial-live-authority-server";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/financial-live";
const SHA_RE = /^[0-9a-f]{40}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MutationBody = {
  state?: unknown;
  authorizedSha?: unknown;
  certificationProfileId?: unknown;
  reasonCode?: unknown;
  expectedVersion?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseState(value: unknown): KlyxFinancialLiveState | null {
  const state = text(value).toUpperCase();
  return state === "DISABLED" ||
    state === "CONTROLLED" ||
    state === "GENERAL"
    ? state
    : null;
}

function parseExpectedVersion(value: unknown): number | null {
  const version = Number(value);
  return Number.isSafeInteger(version) && version >= 1
    ? version
    : null;
}

function deployedSha(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";
}

function envSha(name: string): string {
  return process.env[name]?.trim().toLowerCase() ?? "";
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();
    const authority = await getKlyxFinancialLiveAuthority();
    const deployed = deployedSha();

    return NextResponse.json({
      authority,
      deployment: {
        sha: SHA_RE.test(deployed) ? deployed : null,
        authorityShaMatchesDeployment:
          Boolean(authority.authorizedSha) &&
          authority.authorizedSha === deployed,
        drShaMatchesDeployment:
          SHA_RE.test(deployed) &&
          envSha("KLYX_DR_CERTIFIED_SHA") === deployed,
        financialCertifiedShaMatchesDeployment:
          SHA_RE.test(deployed) &&
          envSha("KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA") ===
            deployed,
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_financial_live_read_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_FINANCIAL_LIVE_READ_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as MutationBody;
    const state = parseState(body.state);
    const expectedVersion = parseExpectedVersion(
      body.expectedVersion
    );
    const reasonCode = text(body.reasonCode).toUpperCase();
    const deployed = deployedSha();

    if (!state || !reasonCode || expectedVersion === null) {
      return NextResponse.json(
        {
          error:
            "state, reasonCode et expectedVersion valides sont obligatoires.",
        },
        { status: 400 }
      );
    }

    let authorizedSha: string | null = null;
    let certificationProfileId: string | null = null;

    if (state !== "DISABLED") {
      authorizedSha = text(body.authorizedSha).toLowerCase();

      if (!SHA_RE.test(authorizedSha)) {
        return NextResponse.json(
          { error: "authorizedSha doit être un SHA Git complet." },
          { status: 400 }
        );
      }

      if (!SHA_RE.test(deployed) || authorizedSha !== deployed) {
        return NextResponse.json(
          {
            error:
              "Le SHA autorisé doit être exactement le SHA Vercel actuellement déployé.",
            code: "KLYX_FINANCIAL_LIVE_DEPLOYMENT_SHA_MISMATCH",
          },
          { status: 409 }
        );
      }

      if (envSha("KLYX_DR_CERTIFIED_SHA") !== deployed) {
        return NextResponse.json(
          {
            error:
              "Le SHA DR certifié ne correspond pas au déploiement.",
            code: "KLYX_FINANCIAL_LIVE_DR_SHA_MISMATCH",
          },
          { status: 409 }
        );
      }
    }

    if (state === "CONTROLLED") {
      certificationProfileId = text(
        body.certificationProfileId
      ).toLowerCase();

      if (!UUID_RE.test(certificationProfileId)) {
        return NextResponse.json(
          {
            error:
              "certificationProfileId est obligatoire en CONTROLLED.",
          },
          { status: 400 }
        );
      }
    }

    if (
      state === "GENERAL" &&
      envSha("KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA") !==
        deployed
    ) {
      return NextResponse.json(
        {
          error:
            "GENERAL exige la certification financière exacte du SHA déployé.",
          code:
            "KLYX_FINANCIAL_LIVE_FINANCIAL_CERTIFICATION_SHA_MISMATCH",
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "klyx_set_financial_live_authority",
      {
        p_state: state,
        p_authorized_sha: authorizedSha,
        p_certification_profile_id: certificationProfileId,
        p_reason_code: reasonCode,
        p_operator_user_id: founder.id,
        p_expected_version: expectedVersion,
      }
    );

    if (error) throw error;

    const authority = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      ok: true,
      authority: authority ?? null,
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_financial_live_write_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_FOUNDER_FINANCIAL_LIVE_WRITE_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
