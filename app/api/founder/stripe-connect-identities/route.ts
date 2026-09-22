import { NextResponse } from "next/server";
import Stripe from "stripe";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/stripe-connect-identities";

type ResolveBody = {
  accountId?: unknown;
  stripeAccountId?: unknown;
  reasonCode?: unknown;
};

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireLiveStripeDiagnosticsClient(): Stripe {
  const mode = process.env.KLYX_STRIPE_MODE?.trim().toLowerCase() ?? "";
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (mode !== "live" || !key.startsWith("sk_live_")) {
    throw new Error("KLYX_STRIPE_CONNECT_RESOLUTION_LIVE_DIAGNOSTICS_REQUIRED");
  }

  return new Stripe(key);
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const [{ data: identities, error: identitiesError }, { data: events, error: eventsError }] =
      await Promise.all([
        supabaseAdmin
          .from("account_stripe_connect_identities")
          .select(
            "account_id, stripe_account_id, identity_state, source_profile_ids, conflicting_stripe_account_ids, manually_resolved, resolved_at, resolved_by_user_id, resolution_reason_code, updated_at"
          )
          .order("updated_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("account_stripe_connect_identity_events")
          .select(
            "id, account_id, event_type, previous_identity_state, previous_stripe_account_id, selected_stripe_account_id, previous_conflicting_stripe_account_ids, operator_user_id, operator_ref, reason_code, evidence, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

    if (identitiesError) throw identitiesError;
    if (eventsError) throw eventsError;

    return NextResponse.json({
      identities: identities ?? [],
      events: events ?? [],
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_stripe_connect_identities_read_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_STRIPE_CONNECT_IDENTITIES_READ_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as ResolveBody;

    const accountId = requiredText(body.accountId);
    const stripeAccountId = requiredText(body.stripeAccountId);
    const reasonCode = requiredText(body.reasonCode).toUpperCase();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        accountId
      )
    ) {
      return NextResponse.json(
        { error: "accountId invalide." },
        { status: 400 }
      );
    }

    if (!/^acct_[A-Za-z0-9]+$/.test(stripeAccountId)) {
      return NextResponse.json(
        { error: "stripeAccountId invalide." },
        { status: 400 }
      );
    }

    if (!/^[A-Z0-9_.:-]{3,120}$/.test(reasonCode)) {
      return NextResponse.json(
        { error: "reasonCode invalide." },
        { status: 400 }
      );
    }

    const stripe = requireLiveStripeDiagnosticsClient();
    const connectedAccount = await stripe.accounts.retrieve(stripeAccountId);

    if ("deleted" in connectedAccount && connectedAccount.deleted) {
      throw new Error("KLYX_STRIPE_CONNECT_RESOLUTION_ACCOUNT_DELETED");
    }

    const requirements = connectedAccount.requirements;
    const evidence = {
      stripeVerifiedAt: new Date().toISOString(),
      country: connectedAccount.country ?? null,
      businessType: connectedAccount.business_type ?? null,
      detailsSubmitted: Boolean(connectedAccount.details_submitted),
      chargesEnabled: Boolean(connectedAccount.charges_enabled),
      payoutsEnabled: Boolean(connectedAccount.payouts_enabled),
      transferCapability:
        connectedAccount.capabilities?.transfers ?? null,
      currentlyDueCount: requirements?.currently_due?.length ?? 0,
      pastDueCount: requirements?.past_due?.length ?? 0,
      pendingVerificationCount:
        requirements?.pending_verification?.length ?? 0,
    };

    const { data, error } = await supabaseAdmin.rpc(
      "klyx_resolve_account_stripe_connect_identity",
      {
        p_account_id: accountId,
        p_selected_stripe_account_id: stripeAccountId,
        p_operator_user_id: founder.id,
        p_operator_ref: "founder_api:stripe_connect_identity_resolution",
        p_reason_code: reasonCode,
        p_evidence: evidence,
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      ok: true,
      identity: result ?? null,
      stripeEvidence: evidence,
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_stripe_connect_identity_resolution_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_FOUNDER_STRIPE_CONNECT_IDENTITY_RESOLUTION_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
