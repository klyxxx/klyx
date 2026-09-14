import { NextResponse } from "next/server";

import {
  activateAccountOfferServices,
  loadAccountOfferReadiness,
} from "@/lib/account-offer-readiness-server";
import { secureApiErrorResponse } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ActivationBody = {
  serviceSlug?: unknown;
};

function cleanServiceSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return slug ? slug.slice(0, 160) : null;
}

async function authenticatedAccountId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("id, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.auth_user_id !== user.id) {
    throw new Error("Compte KLYX introuvable.");
  }

  return data.id as string;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const accountId = await authenticatedAccountId();
    if (!accountId) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const serviceSlug = cleanServiceSlug(
      new URL(request.url).searchParams.get("serviceSlug")
    );
    const readiness = await loadAccountOfferReadiness({
      accountId,
      serviceSlug,
    });

    return NextResponse.json({ readiness });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "account_offer_readiness_load_failed",
      route: "/api/account/offer-readiness",
      method: "GET",
      status: 500,
      code: "KLYX_ACCOUNT_OFFER_READINESS_LOAD_FAILED",
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const accountId = await authenticatedAccountId();
    if (!accountId) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    let body: ActivationBody;
    try {
      body = (await request.json()) as ActivationBody;
    } catch {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const serviceSlug = cleanServiceSlug(body.serviceSlug);
    const result = await activateAccountOfferServices({
      accountId,
      serviceSlug,
    });

    if (!result.activated) {
      return NextResponse.json(
        {
          success: false,
          code:
            result.readiness.status === "human_review"
              ? "KLYX_OFFER_SERVICES_HUMAN_REVIEW_REQUIRED"
              : result.readiness.status === "blocked"
                ? "KLYX_OFFER_SERVICES_BLOCKED"
                : "KLYX_OFFER_SERVICES_REQUIREMENTS_MISSING",
          readiness: result.readiness,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      activated: true,
      readiness: result.readiness,
      account: {
        id: accountId,
        canOfferServices: result.capabilityState.canOfferServices,
        enabledCapabilities: Array.from(
          result.capabilityState.enabledCapabilities
        ),
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "account_offer_activation_failed",
      route: "/api/account/offer-readiness",
      method: "POST",
      status: 500,
      code: "KLYX_ACCOUNT_OFFER_ACTIVATION_FAILED",
      startedAt,
    });
  }
}
