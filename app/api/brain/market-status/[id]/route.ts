import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

type Stage =
  | "waiting_offers"
  | "compare_offers"
  | "finalize_booking"
  | "booking_created"
  | "payment_pending"
  | "paid"
  | "completed";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: requestId } = await context.params;

    const { data: marketRequest, error: requestError } =
      await supabaseAdmin
        .from("market_service_requests")
        .select(
          "id, client_profile_id, status, accepted_offer_id, title, created_at"
        )
        .eq("id", requestId)
        .eq("client_profile_id", profile.id)
        .maybeSingle();

    if (requestError) throw new Error(requestError.message);

    if (!marketRequest) {
      return NextResponse.json(
        { error: "Demande introuvable." },
        { status: 404 }
      );
    }

    const { data: offers, error: offersError } =
      await supabaseAdmin
        .from("market_service_offers")
        .select("id, status")
        .eq("request_id", requestId);

    if (offersError) throw new Error(offersError.message);

    const sentOffers = (offers ?? []).filter(
      (offer) => offer.status === "sent"
    ).length;

    const { data: quote, error: quoteError } =
      await supabaseAdmin
        .from("service_quotes")
        .select("id, status")
        .eq("market_request_id", requestId)
        .maybeSingle();

    if (quoteError) throw new Error(quoteError.message);

    let booking:
      | {
          id: string;
          status: string | null;
          payment_status: string | null;
        }
      | null = null;

    if (quote?.id) {
      const { data: bookingRow, error: bookingError } =
        await supabaseAdmin
          .from("bookings")
          .select("id, status, payment_status")
          .eq("quote_id", quote.id)
          .maybeSingle();

      if (bookingError) throw new Error(bookingError.message);

      booking = bookingRow;
    }

    let stage: Stage = "waiting_offers";
    let title = "KLYX suit ta demande";
    let description =
      "Ta demande est publiée. KLYX attend maintenant les offres compatibles.";
    let nextHref = "/requests";
    let nextLabel = "Voir ma demande";

    if (booking?.status === "completed") {
      stage = "completed";
      title = "Mission terminée";
      description =
        "La mission est terminée. Tu peux maintenant vérifier les prochaines actions et laisser un avis si disponible.";
      nextHref = `/bookings/${booking.id}`;
      nextLabel = "Voir la mission";
    } else if (booking?.payment_status === "paid") {
      stage = "paid";
      title = "Paiement confirmé";
      description =
        "Le paiement est confirmé. KLYX peut maintenant suivre la mission jusqu’à sa réalisation.";
      nextHref = `/bookings/${booking.id}`;
      nextLabel = "Suivre la mission";
    } else if (
      booking &&
      booking.payment_status !== "paid"
    ) {
      stage = "payment_pending";
      title = "Réservation créée";
      description =
        "Le prestataire et le créneau sont fixés. Le paiement reste la prochaine étape transactionnelle.";
      nextHref = `/bookings/${booking.id}`;
      nextLabel = "Voir la réservation";
    } else if (quote?.id) {
      stage = "finalize_booking";
      title = "Prestataire choisi";
      description =
        "Le prix est verrouillé dans KLYX. Il reste à confirmer le créneau pour créer la réservation.";
      nextHref = `/quotes/${quote.id}/book`;
      nextLabel = "Finaliser la réservation";
    } else if (
      marketRequest.status === "matched" ||
      marketRequest.accepted_offer_id
    ) {
      stage = "booking_created";
      title = "Choix enregistré";
      description =
        "Ton choix est enregistré. KLYX prépare la suite de la réservation.";
      nextHref = "/requests";
      nextLabel = "Actualiser ma demande";
    } else if (sentOffers > 0) {
      stage = "compare_offers";
      title = `${sentOffers} offre${sentOffers > 1 ? "s" : ""} à comparer`;
      description =
        "KLYX peut maintenant comparer les propositions selon le prix, la confiance et l’expérience.";
      nextHref = `/assistant/market/${requestId}`;
      nextLabel = "Comparer avec KLYX";
    }

    return NextResponse.json({
      requestId,
      stage,
      title,
      description,
      nextHref,
      nextLabel,
      offerCount: (offers ?? []).length,
      sentOfferCount: sentOffers,
      quoteId: quote?.id ?? null,
      bookingId: booking?.id ?? null,
      bookingStatus: booking?.status ?? null,
      paymentStatus: booking?.payment_status ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de suivre la demande.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
