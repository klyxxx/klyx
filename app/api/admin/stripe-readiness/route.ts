import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedProfile } from "@/lib/api-auth";
import { inspectStripeRuntime } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireAdmin(request: Request) {
  const { user } = await getAuthenticatedProfile(request);

  const adminEmails = (process.env.KLYX_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    !user.email ||
    !adminEmails.includes(user.email.toLowerCase())
  ) {
    throw new Error("Acces administrateur requis.");
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const report = inspectStripeRuntime();
    const secretKey =
      process.env.STRIPE_SECRET_KEY?.trim() ?? "";

    const connectChecks: Array<{
      profileId: string;
      accountId: string;
      ok: boolean;
      detail: string;
    }> = [];

    if (
      report.checks.find((check) => check.key === "secret_key")
        ?.ok
    ) {
      const stripe = new Stripe(secretKey);

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, stripe_account_id")
        .not("stripe_account_id", "is", null)
        .limit(25);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data ?? []) {
        const accountId =
          typeof row.stripe_account_id === "string"
            ? row.stripe_account_id
            : "";

        if (!accountId) continue;

        try {
          const account =
            await stripe.accounts.retrieve(accountId);

          connectChecks.push({
            profileId: row.id,
            accountId,
            ok: !("deleted" in account && account.deleted),
            detail:
              "Compte accessible avec la cle Stripe du mode actuel.",
          });
        } catch {
          connectChecks.push({
            profileId: row.id,
            accountId,
            ok: false,
            detail:
              "Ce compte Connect n'est pas accessible avec la cle Stripe actuelle. Il peut appartenir a l'autre mode test/live.",
          });
        }
      }
    }

    const connectReady =
      connectChecks.length === 0 ||
      connectChecks.every((check) => check.ok);

    return NextResponse.json({
      ...report,
      connectReady,
      ready: report.ready && connectReady,
      connectChecks,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Controle Stripe impossible.";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Acces administrateur requis."
            ? 403
            : 500,
      }
    );
  }
}
