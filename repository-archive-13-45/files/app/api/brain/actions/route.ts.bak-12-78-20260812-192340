import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

type ActionItem = {
  id: string;
  kind:
    | "compare_offers"
    | "finalize_booking"
    | "payment_pending"
    | "review_completed"
    | "provider_offer_update";
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    const actions: ActionItem[] = [];

    if (profile.accountType === "client") {
      const { data: marketRequests, error: marketError } =
        await supabaseAdmin
          .from("market_service_requests")
          .select(
            "id, title, status, accepted_offer_id, created_at"
          )
          .eq("client_profile_id", profile.id)
          .in("status", ["open", "matched"])
          .order("created_at", { ascending: false })
          .limit(30);

      if (marketError) throw new Error(marketError.message);

      const requestIds = (marketRequests ?? []).map((item) => item.id);

      const [
        { data: offers, error: offersError },
        { data: quotes, error: quotesError },
      ] = await Promise.all([
        requestIds.length
          ? supabaseAdmin
              .from("market_service_offers")
              .select("id, request_id, status")
              .in("request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
        requestIds.length
          ? supabaseAdmin
              .from("service_quotes")
              .select("id, market_request_id, status")
              .in("market_request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (offersError) throw new Error(offersError.message);
      if (quotesError) throw new Error(quotesError.message);

      const quoteMap = new Map(
        (quotes ?? []).map((quote) => [quote.market_request_id, quote])
      );

      for (const item of marketRequests ?? []) {
        const sentOffers = (offers ?? []).filter(
          (offer) =>
            offer.request_id === item.id &&
            offer.status === "sent"
        ).length;

        const quote = quoteMap.get(item.id);

        if (item.status === "open" && sentOffers > 0) {
          actions.push({
            id: `compare-${item.id}`,
            kind: "compare_offers",
            priority: 90,
            title: `${sentOffers} offre${sentOffers > 1 ? "s" : ""} à comparer`,
            description: item.title,
            href: `/assistant/market/${item.id}`,
            label: "Comparer avec KLYX",
          });
        }

        if (quote?.id) {
          const { data: booking, error: bookingError } =
            await supabaseAdmin
              .from("bookings")
              .select("id, status, payment_status")
              .eq("quote_id", quote.id)
              .maybeSingle();

          if (bookingError) throw new Error(bookingError.message);

          if (!booking) {
            actions.push({
              id: `finalize-${item.id}`,
              kind: "finalize_booking",
              priority: 100,
              title: "Finaliser la réservation",
              description:
                "Le prestataire et le prix sont déjà choisis. Il reste à confirmer le créneau.",
              href: `/quotes/${quote.id}/book`,
              label: "Choisir le créneau",
            });
          } else if (booking.payment_status !== "paid") {
            actions.push({
              id: `payment-${booking.id}`,
              kind: "payment_pending",
              priority: 95,
              title: "Paiement à finaliser",
              description:
                "La réservation existe. Vérifie son statut et termine le paiement si nécessaire.",
              href: `/bookings/${booking.id}`,
              label: "Voir la réservation",
            });
          } else if (booking.status === "completed") {
            actions.push({
              id: `review-${booking.id}`,
              kind: "review_completed",
              priority: 60,
              title: "Mission terminée",
              description:
                "Tu peux maintenant consulter la mission et laisser un avis si ce n’est pas déjà fait.",
              href: `/bookings/${booking.id}`,
              label: "Voir la mission",
            });
          }
        }
      }
    } else {
      const { data: offers, error: offersError } =
        await supabaseAdmin
          .from("market_service_offers")
          .select("id, request_id, amount, status, updated_at")
          .eq("provider_profile_id", profile.id)
          .in("status", ["sent", "accepted"])
          .order("updated_at", { ascending: false })
          .limit(30);

      if (offersError) throw new Error(offersError.message);

      for (const offer of offers ?? []) {
        if (offer.status === "accepted") {
          actions.push({
            id: `provider-accepted-${offer.id}`,
            kind: "provider_offer_update",
            priority: 100,
            title: "Une offre a été acceptée",
            description: `Montant accepté : ${Number(offer.amount).toFixed(2)} €.`,
            href: "/bookings",
            label: "Voir mes réservations",
          });
        }
      }
    }

    actions.sort((first, second) => second.priority - first.priority);

    return NextResponse.json({
      profileId: profile.id,
      accountType: profile.accountType,
      actions: actions.slice(0, 20),
      count: actions.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les actions KLYX.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
