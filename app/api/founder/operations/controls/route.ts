import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/operations/controls";

type ManualControlBody = {
  scopeType?: unknown;
  scopeKey?: unknown;
  state?: unknown;
  reasonCode?: unknown;
  marketId?: unknown;
  regionId?: unknown;
  countryCode?: unknown;
  currency?: unknown;
  paymentProvider?: unknown;
  capability?: unknown;
  dependency?: unknown;
  expiresAt?: unknown;
};

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const normalized = requiredText(value);
  return normalized || null;
}

function parseExpiry(value: unknown): string | null {
  const raw = optionalText(value);
  if (!raw) return null;

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("KLYX_OPS_EXPIRES_AT_INVALID");
  }

  return date.toISOString();
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const { data, error } = await supabaseAdmin
      .from("ops_capability_controls")
      .select(
        "id, control_key, scope_type, scope_key, market_id, region_id, country_code, currency, payment_provider, capability, dependency, state, reason_code, operator_user_id, expires_at, version, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({
      controls: data ?? [],
      semantics: {
        disabledIsBlocking: true,
        enabledDoesNotOverrideAnotherDisabledControl: true,
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_operations_controls_read_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_OPERATIONS_CONTROLS_READ_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as ManualControlBody;

    const scopeType = requiredText(body.scopeType).toLowerCase();
    const scopeKey = requiredText(body.scopeKey);
    const state = requiredText(body.state).toUpperCase();
    const reasonCode = requiredText(body.reasonCode).toUpperCase();

    if (!scopeType || !scopeKey || !reasonCode) {
      return NextResponse.json(
        {
          error:
            "scopeType, scopeKey et reasonCode sont obligatoires.",
        },
        { status: 400 }
      );
    }

    if (state !== "ENABLED" && state !== "DISABLED") {
      return NextResponse.json(
        { error: "state doit être ENABLED ou DISABLED." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "klyx_ops_set_manual_control",
      {
        p_scope_type: scopeType,
        p_scope_key: scopeKey,
        p_state: state,
        p_reason_code: reasonCode,
        p_operator_user_id: founder.id,
        p_market_id: optionalText(body.marketId),
        p_region_id: optionalText(body.regionId),
        p_country_code:
          optionalText(body.countryCode)?.toUpperCase() ?? null,
        p_currency:
          optionalText(body.currency)?.toUpperCase() ?? null,
        p_payment_provider:
          optionalText(body.paymentProvider)?.toLowerCase() ?? null,
        p_capability:
          optionalText(body.capability)?.toLowerCase() ?? null,
        p_dependency:
          optionalText(body.dependency)?.toLowerCase() ?? null,
        p_expires_at: parseExpiry(body.expiresAt),
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      ok: true,
      control: result ?? null,
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_operations_controls_write_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_FOUNDER_OPERATIONS_CONTROLS_WRITE_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
