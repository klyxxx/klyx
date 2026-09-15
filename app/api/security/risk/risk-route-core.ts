import { NextResponse } from "next/server";

import {
  evaluateCanonicalAccountRisk,
  type CanonicalRiskAccount,
} from "@/lib/account-risk-server";
import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { account } = await getAuthenticatedAccount(request);
    const canonicalRiskAccount: CanonicalRiskAccount = {
      id: account.id,
      authUserId: account.authUserId,
      canOfferServices: account.canOfferServices,
    };
    const { assessment, metrics } =
      await evaluateCanonicalAccountRisk(canonicalRiskAccount);

    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("account_security_alerts")
      .select(
        "id, alert_type, severity, title, description, status, created_at"
      )
      .eq("account_id", account.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (alertsError) {
      throw new Error(alertsError.message);
    }

    return NextResponse.json({
      assessment,
      metrics,
      alerts: alerts ?? [],
      automaticRestriction: false,
      explanation:
        "KLYX détecte les signaux au niveau du compte canonique, mais aucune suspension définitive n’est décidée automatiquement.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’évaluer la sécurité du compte.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
