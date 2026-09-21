import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { getKlyxBuildReleaseSha } from "@/lib/klyx-build-release";
import {
  inspectLiveFinancialAuthorization,
  KLYX_LIVE_FINANCIAL_CONTROL_KEY,
} from "@/lib/live-financial-authorization-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/live-financial-authorization";

type MutationBody = {
  action?: unknown;
  certifiedSha?: unknown;
  expectedVersion?: unknown;
  reasonCode?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function version(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();
    const buildReleaseSha = getKlyxBuildReleaseSha();
    const readiness = await inspectLiveFinancialAuthorization({
      requireArmed: false,
      candidateCertifiedSha: buildReleaseSha,
    });
    const current = await inspectLiveFinancialAuthorization({
      requireArmed: true,
    });

    return noStore({
      controlKey: KLYX_LIVE_FINANCIAL_CONTROL_KEY,
      buildReleaseSha,
      readiness,
      current,
      semantics: {
        stripeModeIsNotAuthorization: true,
        explicitArmRequired: true,
        disarmAlwaysAvailable: true,
        exactShaRequired: true,
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_live_financial_authorization_read_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_LIVE_FINANCIAL_AUTHORIZATION_READ_FAILED",
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
    const action = text(body.action).toLowerCase();
    const expectedVersion = version(body.expectedVersion);
    const reasonCode = text(body.reasonCode).toUpperCase();

    if (!["arm", "disarm"].includes(action)) {
      return noStore({ error: "action doit être arm ou disarm." }, 400);
    }
    if (!expectedVersion || !reasonCode) {
      return noStore(
        { error: "expectedVersion et reasonCode sont obligatoires." },
        400
      );
    }

    const buildReleaseSha = getKlyxBuildReleaseSha();

    if (action === "arm") {
      const certifiedSha = text(body.certifiedSha).toLowerCase();

      if (!buildReleaseSha || certifiedSha !== buildReleaseSha) {
        return noStore(
          {
            error:
              "Le SHA certifié doit être exactement le SHA immuable du build déployé.",
            code: "KLYX_LIVE_FINANCIAL_SHA_MISMATCH",
            buildReleaseSha,
          },
          409
        );
      }

      const readiness = await inspectLiveFinancialAuthorization({
        requireArmed: false,
        candidateCertifiedSha: certifiedSha,
      });

      if (!readiness.ready) {
        return noStore(
          {
            error: "KLYX LIVE financier n'est pas prêt à être armé.",
            code: "KLYX_LIVE_FINANCIAL_NOT_READY",
            readiness,
          },
          409
        );
      }
    }

    const certifiedSha =
      action === "arm"
        ? text(body.certifiedSha).toLowerCase()
        : null;

    const { data, error } = await supabaseAdmin.rpc(
      "klyx_set_financial_live_authorization",
      {
        p_to_state: action === "arm" ? "armed" : "disarmed",
        p_certified_sha: certifiedSha,
        p_operator_auth_user_id: founder.id,
        p_reason_code: reasonCode,
        p_expected_version: expectedVersion,
      }
    );

    if (error) throw error;

    const control = Array.isArray(data) ? data[0] : data;
    const current = await inspectLiveFinancialAuthorization({
      requireArmed: true,
    });

    return noStore({
      ok: true,
      action,
      control,
      current,
    });
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_live_financial_authorization_write_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_FOUNDER_LIVE_FINANCIAL_AUTHORIZATION_WRITE_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
