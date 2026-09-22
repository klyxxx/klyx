import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/expansion/markets";

type ExpansionBody = {
  action?: unknown;
  marketKey?: unknown;
  displayName?: unknown;
  jurisdictionCode?: unknown;
  countryCode?: unknown;
  defaultCurrencyCode?: unknown;
  infrastructureRegion?: unknown;
  riskPolicyKey?: unknown;
  commissionPolicyKey?: unknown;
  expectedVersion?: unknown;
  rolloutState?: unknown;
  featureKey?: unknown;
  requirementType?: unknown;
  requirementKey?: unknown;
  authority?: unknown;
  enforcement?: unknown;
  activityKey?: unknown;
  evidenceRef?: unknown;
  reasonCode?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function version(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("KLYX_EXPANSION_VERSION_INVALID");
  }

  return value;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const [markets, features, requirements] = await Promise.all([
      supabaseAdmin
        .from("klyx_markets")
        .select(
          "market_key,display_name,jurisdiction_code,country_code,default_currency_code,infrastructure_region,rollout_state,risk_policy_key,commission_policy_key,evidence_ref,version,activated_at,created_at,updated_at"
        )
        .order("market_key", { ascending: true }),
      supabaseAdmin
        .from("klyx_market_features")
        .select(
          "market_key,feature_key,rollout_state,evidence_ref,version,updated_at"
        )
        .order("market_key", { ascending: true })
        .order("feature_key", { ascending: true }),
      supabaseAdmin
        .from("klyx_market_requirements")
        .select(
          "id,market_key,requirement_type,requirement_key,authority,enforcement,activity_key,jurisdiction_code,evidence_ref,valid_from,valid_until,version,updated_at"
        )
        .order("market_key", { ascending: true })
        .order("requirement_type", { ascending: true }),
    ]);

    if (markets.error) throw markets.error;
    if (features.error) throw features.error;
    if (requirements.error) throw requirements.error;

    return NextResponse.json({
      markets: markets.data ?? [],
      features: features.data ?? [],
      requirements: requirements.data ?? [],
      semantics: {
        defaultState: "DISABLED",
        operationalHealthAuthority: "operations",
        moneyAuthority: "klyx_market_payment_rules",
        economicAuthority: "economic_identity",
        activityAuthority: "account_capability_qualifications",
        generalDoesNotOverrideBlockingAuthorities: true,
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_expansion_markets_read_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_EXPANSION_MARKETS_READ_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as ExpansionBody;
    const action = text(body.action).toLowerCase();
    const marketKey = text(body.marketKey).toLowerCase();
    const reasonCode = text(body.reasonCode).toUpperCase();
    const expectedVersion = version(body.expectedVersion);

    if (!action || !marketKey || !reasonCode) {
      return NextResponse.json(
        {
          error:
            "action, marketKey, expectedVersion et reasonCode sont obligatoires.",
        },
        { status: 400 }
      );
    }

    if (action === "upsert_manifest") {
      const displayName = text(body.displayName);
      const jurisdictionCode = text(body.jurisdictionCode).toUpperCase();

      if (!displayName || !jurisdictionCode) {
        return NextResponse.json(
          {
            error:
              "displayName et jurisdictionCode sont obligatoires.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin.rpc(
        "klyx_upsert_market_manifest",
        {
          p_market_key: marketKey,
          p_display_name: displayName,
          p_jurisdiction_code: jurisdictionCode,
          p_country_code:
            optionalText(body.countryCode)?.toUpperCase() ?? null,
          p_default_currency_code:
            optionalText(body.defaultCurrencyCode)?.toUpperCase() ??
            null,
          p_infrastructure_region:
            optionalText(body.infrastructureRegion)?.toLowerCase() ??
            null,
          p_risk_policy_key:
            optionalText(body.riskPolicyKey)?.toLowerCase() ?? null,
          p_commission_policy_key:
            optionalText(body.commissionPolicyKey)?.toLowerCase() ??
            null,
          p_evidence_ref: optionalText(body.evidenceRef),
          p_operator_auth_user_id: founder.id,
          p_expected_version: expectedVersion,
          p_reason_code: reasonCode,
        }
      );

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        market: Array.isArray(data) ? data[0] : data,
      });
    }

    if (action === "transition_rollout") {
      const rolloutState = text(body.rolloutState).toUpperCase();

      if (!rolloutState) {
        return NextResponse.json(
          { error: "rolloutState est obligatoire." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin.rpc(
        "klyx_transition_market_rollout",
        {
          p_market_key: marketKey,
          p_expected_version: expectedVersion,
          p_to_state: rolloutState,
          p_operator_auth_user_id: founder.id,
          p_reason_code: reasonCode,
          p_evidence_ref: optionalText(body.evidenceRef),
        }
      );

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        market: Array.isArray(data) ? data[0] : data,
      });
    }

    if (action === "set_feature") {
      const featureKey = text(body.featureKey).toLowerCase();
      const rolloutState = text(body.rolloutState).toUpperCase();

      if (!featureKey || !rolloutState) {
        return NextResponse.json(
          {
            error:
              "featureKey et rolloutState sont obligatoires.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin.rpc(
        "klyx_set_market_feature",
        {
          p_market_key: marketKey,
          p_feature_key: featureKey,
          p_expected_version: expectedVersion,
          p_rollout_state: rolloutState,
          p_operator_auth_user_id: founder.id,
          p_reason_code: reasonCode,
          p_evidence_ref: optionalText(body.evidenceRef),
        }
      );

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        feature: Array.isArray(data) ? data[0] : data,
      });
    }

    if (action === "set_requirement") {
      const requirementType =
        text(body.requirementType).toLowerCase();
      const requirementKey =
        text(body.requirementKey).toLowerCase();
      const authority = text(body.authority).toLowerCase();
      const enforcement = text(body.enforcement).toLowerCase();

      if (
        !requirementType ||
        !requirementKey ||
        !authority ||
        !enforcement
      ) {
        return NextResponse.json(
          {
            error:
              "requirementType, requirementKey, authority et enforcement sont obligatoires.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin.rpc(
        "klyx_set_market_requirement",
        {
          p_market_key: marketKey,
          p_requirement_type: requirementType,
          p_requirement_key: requirementKey,
          p_authority: authority,
          p_enforcement: enforcement,
          p_activity_key:
            optionalText(body.activityKey)?.toLowerCase() ?? null,
          p_jurisdiction_code:
            optionalText(body.jurisdictionCode)?.toUpperCase() ??
            null,
          p_evidence_ref: optionalText(body.evidenceRef),
          p_operator_auth_user_id: founder.id,
          p_expected_version: expectedVersion,
          p_reason_code: reasonCode,
        }
      );

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        requirement: Array.isArray(data) ? data[0] : data,
      });
    }

    return NextResponse.json(
      { error: "Action Global Expansion inconnue." },
      { status: 400 }
    );
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_expansion_markets_write_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_FOUNDER_EXPANSION_MARKETS_WRITE_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
