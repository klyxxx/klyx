import "server-only";

import type { AuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_SERVER_BRAIN_ACTIONS_12_81

export type BrainActionKind =
  | "compare_offers"
  | "finalize_booking"
  | "payment_pending"
  | "track_mission"
  | "confirm_completion"
  | "review_completed"
  | "provider_offer_update"
  | "provider_booking_request"
  | "provider_track_mission"
  | "provider_finish_mission";

export type BrainActionItem = {
  id: string;
  kind: BrainActionKind;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  quote_id: string | null;
  booking_group_id: string | null;
  status: string;
  payment_status: string | null;
  service_status: string | null;
  provider_finished_at: string | null;
  client_confirmed_at: string | null;
  booking_date: string;
  start_time: string;
  created_at: string;
};

type MarketRequestRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type OfferRow = {
  id: string;
  request_id: string;
  status: string;
};

type QuoteRow = {
  id: string;
  market_request_id: string | null;
  status: string;
};

function addAction(
  map: Map<string, BrainActionItem>,
  action: BrainActionItem
) {
  const existing = map.get(action.id);

  if (!existing || action.priority > existing.priority) {
    map.set(action.id, action);
  }
}

function missionPriority(
  status: string | null
) {
  if (status === "arrived") return 108;
  if (status === "en_route") return 104;
  if (status === "in_progress") return 102;

  return 80;
}

function clientMissionTitle(
  status: string | null
) {
  if (status === "arrived") {
    return "Le prestataire est arrive";
  }

  if (status === "en_route") {
    return "Le prestataire est en route";
  }

  if (status === "in_progress") {
    return "Prestation en cours";
  }

  return "Mission planifiee";
}

function clientMissionDescription(
  status: string | null
) {
  if (status === "en_route") {
    return "Le prestataire est en route. Suis la mission depuis KLYX.";
  }

  if (status === "arrived") {
    return "Le prestataire indique etre arrive. La prestation peut commencer.";
  }

  if (status === "in_progress") {
    return "La prestation est en cours. KLYX centralise son suivi.";
  }

  return "Le paiement est confirme et la mission est planifiee.";
}

function providerMissionTitle(
  status: string | null
) {
  if (status === "en_route") {
    return "Continue ton trajet";
  }

  if (status === "arrived") {
    return "Demarre la prestation";
  }

  if (status === "in_progress") {
    return "Prestation en cours";
  }

  return "Mission prete a executer";
}

function providerMissionDescription(
  status: string | null
) {
  if (status === "en_route") {
    return "Indique ton arrivee au client depuis le suivi KLYX.";
  }

  if (status === "arrived") {
    return "Tu es arrive. Confirme le debut de la prestation.";
  }

  if (status === "in_progress") {
    return "Quand le travail est termine, declare la fin de mission.";
  }

  return "Le paiement est confirme. Tu peux commencer le suivi.";
}

async function loadBookings(
  profile: AuthenticatedProfile
): Promise<BookingRow[]> {
  if (profile.accountType === "client") {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, quote_id, booking_group_id, status, payment_status, service_status, provider_finished_at, client_confirmed_at, booking_date, start_time, created_at"
      )
      .eq("parent_id", profile.id)
      .in(
        "status",
        [
          "pending",
          "accepted",
          "completed",
        ]
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(50);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as BookingRow[];
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, quote_id, booking_group_id, status, payment_status, service_status, provider_finished_at, client_confirmed_at, booking_date, start_time, created_at"
    )
    .or(
      "provider_id.eq." +
        profile.id +
        ",babysitter_id.eq." +
        profile.id
    )
    .in(
      "status",
      [
        "pending",
        "accepted",
        "completed",
      ]
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BookingRow[];
}

async function addClientMarketActions(
  profile: AuthenticatedProfile,
  bookings: BookingRow[],
  actions: Map<string, BrainActionItem>
) {
  const {
    data: requestData,
    error: requestError,
  } = await supabaseAdmin
    .from("market_service_requests")
    .select(
      "id, title, status, created_at"
    )
    .eq(
      "client_profile_id",
      profile.id
    )
    .in(
      "status",
      [
        "open",
        "matched",
      ]
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(30);

  if (requestError) {
    throw new Error(requestError.message);
  }

  const requests =
    (requestData ?? []) as MarketRequestRow[];

  const requestIds = requests.map(
    (item) => item.id
  );

  if (requestIds.length === 0) {
    return;
  }

  const [
    offersResult,
    quotesResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("market_service_offers")
      .select(
        "id, request_id, status"
      )
      .in(
        "request_id",
        requestIds
      ),

    supabaseAdmin
      .from("service_quotes")
      .select(
        "id, market_request_id, status"
      )
      .in(
        "market_request_id",
        requestIds
      ),
  ]);

  if (offersResult.error) {
    throw new Error(
      offersResult.error.message
    );
  }

  if (quotesResult.error) {
    throw new Error(
      quotesResult.error.message
    );
  }

  const offers =
    (offersResult.data ?? []) as OfferRow[];

  const quotes =
    (quotesResult.data ?? []) as QuoteRow[];

  const quoteByRequest = new Map(
    quotes
      .filter(
        (item) =>
          Boolean(item.market_request_id)
      )
      .map(
        (item) => [
          item.market_request_id as string,
          item,
        ]
      )
  );

  const bookingByQuote = new Map(
    bookings
      .filter(
        (item) =>
          Boolean(item.quote_id)
      )
      .map(
        (item) => [
          item.quote_id as string,
          item,
        ]
      )
  );

  for (const request of requests) {
    const sentOffers = offers.filter(
      (offer) =>
        offer.request_id === request.id &&
        offer.status === "sent"
    ).length;

    if (
      request.status === "open" &&
      sentOffers > 0
    ) {
      addAction(
        actions,
        {
          id:
            "compare-" +
            request.id,
          kind: "compare_offers",
          priority: 90,
          title:
            sentOffers +
            " offre" +
            (sentOffers > 1 ? "s" : "") +
            " a comparer",
          description:
            request.title,
          href:
            "/assistant/market/" +
            request.id,
          label:
            "Comparer avec KLYX",
        }
      );
    }

    const quote =
      quoteByRequest.get(request.id);

    if (!quote) {
      continue;
    }

    const booking =
      bookingByQuote.get(quote.id);

    if (!booking) {
      addAction(
        actions,
        {
          id:
            "finalize-" +
            request.id,
          kind:
            "finalize_booking",
          priority: 100,
          title:
            "Finaliser la reservation",
          description:
            "Le prestataire et le prix sont choisis. Il reste a confirmer le creneau.",
          href:
            "/quotes/" +
            quote.id +
            "/book",
          label:
            "Choisir le creneau",
        }
      );
    }
  }
}

function addClientBookingActions(
  bookings: BookingRow[],
  actions: Map<string, BrainActionItem>
) {
  for (const booking of bookings) {
        // KLYX_GROUP_ACTIONS_12_85
        if (
          booking.booking_group_id &&
          booking.status === "accepted" &&
          booking.payment_status !== "paid"
        ) {
          addAction(actions, {
            id: "payment-group-" + booking.booking_group_id,
            kind: "payment_pending",
            priority: 110,
            title: "Paiement groupe a finaliser",
            description: "Tous les creneaux sont acceptes. Le groupe attend un paiement unique.",
            href: "/booking-groups/" + booking.booking_group_id,
            label: "Voir le groupe",
          });
          continue;
        }

    if (
      booking.status === "accepted" &&
      booking.payment_status !== "paid"
    ) {
      addAction(
        actions,
        {
          id:
            "payment-" +
            booking.id,
          kind:
            "payment_pending",
          priority: 105,
          title:
            "Paiement a finaliser",
          description:
            "Le prestataire a accepte. Le paiement est la prochaine etape avant la mission.",
          href:
            "/bookings/" +
            booking.id,
          label:
            "Finaliser le paiement",
        }
      );

      continue;
    }

    if (
      booking.status === "accepted" &&
      booking.payment_status === "paid"
    ) {
      if (
        booking.provider_finished_at &&
        !booking.client_confirmed_at
      ) {
        addAction(
          actions,
          {
            id:
              "confirm-completion-" +
              booking.id,
            kind:
              "confirm_completion",
            priority: 120,
            title:
              "Confirme la fin de mission",
            description:
              "Le prestataire a declare son travail termine. Verifie la prestation puis confirme.",
            href:
              "/tracking/" +
              booking.id,
            label:
              "Verifier et confirmer",
          }
        );

        continue;
      }

      addAction(
        actions,
        {
          id:
            "track-" +
            booking.id,
          kind:
            "track_mission",
          priority:
            missionPriority(
              booking.service_status
            ),
          title:
            clientMissionTitle(
              booking.service_status
            ),
          description:
            clientMissionDescription(
              booking.service_status
            ),
          href:
            "/tracking/" +
            booking.id,
          label:
            "Suivre la mission",
        }
      );

      continue;
    }

    if (
      booking.status === "completed"
    ) {
      // KLYX_GROUP_REVIEW_CHILD_GUARD_12_88
      if (
        booking.booking_group_id
      ) {
        continue;
      }

      addAction(
        actions,
        {
          id:
            "review-" +
            booking.id,
          kind:
            "review_completed",
          priority: 60,
          title:
            "Mission terminee",
          description:
            "La mission est terminee. Consulte le resultat et laisse un avis si necessaire.",
          href:
            "/bookings/" +
            booking.id,
          label:
            "Voir la mission",
        }
      );
    }
  }
}

// KLYX_GROUP_REVIEW_ACTIONS_12_88
async function addClientGroupReviewActions(
  profile: AuthenticatedProfile,
  actions: Map<string, BrainActionItem>
) {
  const {
    data: groups,
    error: groupError,
  } = await supabaseAdmin
    .from("booking_groups")
    .select(
      "id, status, payment_status, updated_at"
    )
    .eq(
      "client_profile_id",
      profile.id
    )
    .eq(
      "status",
      "completed"
    )
    .eq(
      "payment_status",
      "paid"
    )
    .order(
      "updated_at",
      {
        ascending: false,
      }
    )
    .limit(20);

  if (groupError) {
    throw new Error(
      groupError.message
    );
  }

  const groupIds =
    (
      groups ??
      []
    ).map(
      (group) =>
        group.id
    );

  if (
    groupIds.length === 0
  ) {
    return;
  }

  const {
    data: reviews,
    error: reviewError,
  } = await supabaseAdmin
    .from("reviews")
    .select(
      "booking_group_id"
    )
    .eq(
      "author_id",
      profile.id
    )
    .in(
      "booking_group_id",
      groupIds
    );

  if (reviewError) {
    throw new Error(
      reviewError.message
    );
  }

  const reviewed =
    new Set(
      (
        reviews ??
        []
      )
        .map(
          (review) =>
            review.booking_group_id
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              value
            )
        )
    );

  for (
    const group
    of groups ??
    []
  ) {
    if (
      reviewed.has(
        group.id
      )
    ) {
      continue;
    }

    addAction(
      actions,
      {
        id:
          "review-group-" +
          group.id,

        kind:
          "review_completed",

        priority: 65,

        title:
          "Mission groupee terminee",

        description:
          "Tous les creneaux sont termines. Un seul avis KLYX evalue toute la mission.",

        href:
          "/reviews/group/" +
          group.id,

        label:
          "Donner mon avis",
      }
    );
  }
}
async function addProviderActions(
  profile: AuthenticatedProfile,
  bookings: BookingRow[],
  actions: Map<string, BrainActionItem>
) {
  const {
    data: offersData,
    error: offersError,
  } = await supabaseAdmin
    .from("market_service_offers")
    .select(
      "id, request_id, amount, status, updated_at"
    )
    .eq(
      "provider_profile_id",
      profile.id
    )
    .in(
      "status",
      [
        "sent",
        "accepted",
      ]
    )
    .order(
      "updated_at",
      {
        ascending: false,
      }
    )
    .limit(30);

  if (offersError) {
    throw new Error(
      offersError.message
    );
  }

  for (const offer of offersData ?? []) {
    if (
      offer.status === "accepted"
    ) {
      addAction(
        actions,
        {
          id:
            "provider-offer-" +
            offer.id,
          kind:
            "provider_offer_update",
          priority: 85,
          title:
            "Une offre a ete acceptee",
          description:
            "Montant accepte : " +
            Number(
              offer.amount
            ).toFixed(2) +
            " EUR.",
          href:
            "/bookings",
          label:
            "Voir mes reservations",
        }
      );
    }
  }

  for (const booking of bookings) {
        if (
          booking.booking_group_id &&
          booking.status === "pending"
        ) {
          addAction(actions, {
            id: "provider-group-" + booking.booking_group_id,
            kind: "provider_booking_request",
            priority: 125,
            title: "Reservation groupee a confirmer",
            description: "Le client t a selectionne pour plusieurs creneaux. Confirme le groupe complet.",
            href: "/booking-groups/" + booking.booking_group_id,
            label: "Traiter le groupe",
          });
          continue;
        }

    if (
      booking.status === "pending"
    ) {
      addAction(
        actions,
        {
          id:
            "provider-booking-" +
            booking.id,
          kind:
            "provider_booking_request",
          priority: 120,
          title:
            "Nouvelle reservation a traiter",
          description:
            "Un client attend ta reponse. Accepte ou refuse la demande.",
          href:
            "/bookings/" +
            booking.id,
          label:
            "Repondre maintenant",
        }
      );

      continue;
    }

    if (
      booking.status !== "accepted" ||
      booking.payment_status !== "paid"
    ) {
      continue;
    }

    if (
      booking.provider_finished_at &&
      !booking.client_confirmed_at
    ) {
      continue;
    }

    if (
      booking.service_status === "in_progress" &&
      !booking.provider_finished_at
    ) {
      addAction(
        actions,
        {
          id:
            "provider-finish-" +
            booking.id,
          kind:
            "provider_finish_mission",
          priority: 115,
          title:
            "Termine la mission dans KLYX",
          description:
            "La prestation est en cours. Quand le travail est fini, declare la mission terminee.",
          href:
            "/tracking/" +
            booking.id,
          label:
            "Declarer la fin",
        }
      );

      continue;
    }

    addAction(
      actions,
      {
        id:
          "provider-track-" +
          booking.id,
        kind:
          "provider_track_mission",
        priority:
          missionPriority(
            booking.service_status
          ) + 5,
        title:
          providerMissionTitle(
            booking.service_status
          ),
        description:
          providerMissionDescription(
            booking.service_status
          ),
        href:
          "/tracking/" +
          booking.id,
        label:
          "Ouvrir le suivi",
      }
    );
  }
}

export async function getBrainActions(
  profile: AuthenticatedProfile
): Promise<BrainActionItem[]> {
  const actionMap =
    new Map<string, BrainActionItem>();

  const bookings =
    await loadBookings(profile);

  if (
    profile.accountType === "client"
  ) {
    await addClientMarketActions(
      profile,
      bookings,
      actionMap
    );

    addClientBookingActions(
      bookings,
      actionMap
    );
    await addClientGroupReviewActions(
      profile,
      actionMap
    );
  } else {
    await addProviderActions(
      profile,
      bookings,
      actionMap
    );
  }

  return Array.from(
    actionMap.values()
  ).sort(
    (first, second) =>
      second.priority -
      first.priority
  );
}