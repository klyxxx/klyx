import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

function getAppOrigin(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = configuredUrl || new URL(request.url).origin;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL doit commencer par http:// ou https://."
    );
  }

  return parsed.origin;
}

export async function POST(request: Request) {
  try {
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const { user, profile: activeProfile } =
      await getAuthenticatedProfile(request);
    requireAccountType(activeProfile, "provider");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_account_id")
      .eq("id", activeProfile.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Profil KLYX introuvable." },
        { status: 404 }
      );
    }

    let accountId = profile.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "BE",
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          klyx_profile_id: activeProfile.id,
          klyx_owner_user_id: user.id,
        },
      });

      accountId = account.id;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_account_id: account.id,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
        })
        .eq("id", activeProfile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    const origin = getAppOrigin(request);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/connect?refresh=1`,
      return_url: `${origin}/connect?return=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe Connect account error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Impossible de démarrer Stripe Connect.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: apiErrorStatus(message) }
    );
  }
}
