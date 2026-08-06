import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const body = (await request.json()) as { confirmation?: unknown };

    if (body.confirmation !== "SUPPRIMER") {
      return NextResponse.json(
        { error: "Écris exactement SUPPRIMER pour confirmer." },
        { status: 400 }
      );
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_account_id")
      .eq("owner_user_id", user.id);

    if (profilesError) throw new Error(profilesError.message);

    const profileIds = (profiles ?? []).map((profile) => profile.id);

    if (profileIds.length > 0) {
      const [{ data: clientBookings }, { data: providerBookings }] =
        await Promise.all([
          supabaseAdmin
            .from("bookings")
            .select("id")
            .in("parent_id", profileIds)
            .in("status", ["pending", "accepted"]),
          supabaseAdmin
            .from("bookings")
            .select("id")
            .in("provider_id", profileIds)
            .in("status", ["pending", "accepted"]),
        ]);

      if (
        (clientBookings?.length ?? 0) > 0 ||
        (providerBookings?.length ?? 0) > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Annule ou termine d’abord toutes les réservations actives.",
          },
          { status: 409 }
        );
      }

      const [{ data: paidClient }, { data: paidProvider }] =
        await Promise.all([
          supabaseAdmin
            .from("bookings")
            .select("id")
            .in("parent_id", profileIds)
            .eq("payment_status", "paid")
            .limit(1),
          supabaseAdmin
            .from("bookings")
            .select("id")
            .in("provider_id", profileIds)
            .eq("payment_status", "paid")
            .limit(1),
        ]);

      if (
        (paidClient?.length ?? 0) > 0 ||
        (paidProvider?.length ?? 0) > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Ce compte contient un paiement. La suppression avec anonymisation financière sera ajoutée avant l’ouverture publique.",
          },
          { status: 409 }
        );
      }
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (stripeKey) {
      const stripe = new Stripe(stripeKey);

      for (const profile of profiles ?? []) {
        if (!profile.stripe_account_id) continue;

        try {
          await stripe.accounts.del(profile.stripe_account_id);
        } catch {
          return NextResponse.json(
            {
              error:
                "Stripe empêche encore la suppression de ce compte prestataire.",
            },
            { status: 409 }
          );
        }
      }
    }

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer le compte.",
      },
      { status: 500 }
    );
  }
}
