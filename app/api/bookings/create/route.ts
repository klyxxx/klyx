import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isUserServiceApproved } from "@/lib/provider-skill-publication";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  isPastBookingStart,
  isValidCalendarDate,
  timeToMinutes,
  todayInBrussels,
} from "@/lib/brussels-time";

type PricingType = "hourly" | "fixed";

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

type ExistingBookingRow = {
  id: string;
  start_time: string;
  end_time: string;
};

type AcceptedQuoteRow = {
  id: string;
  client_profile_id: string;
  provider_profile_id: string;
  user_service_id: string;
  requested_date: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  pricing_type: string;
  provider_price: number | null;
  status: string;
  expires_at: string | null;
};

function serviceLabel(slug: string): string {
  const labels: Record<string, string> = {
    babysitting: "Baby-sitting",
    cleaning: "Ménage",
    moving: "Déménagement",
    handyman: "Bricolage",
  };

  return labels[slug] ?? "Service KLYX";
}

function overlaps(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
): boolean {
  const firstStartMinutes = timeToMinutes(firstStart);
  const firstEndMinutes = timeToMinutes(firstEnd);
  const secondStartMinutes = timeToMinutes(secondStart);
  const secondEndMinutes = timeToMinutes(secondEnd);

  if (
    firstStartMinutes === null ||
    firstEndMinutes === null ||
    secondStartMinutes === null ||
    secondEndMinutes === null
  ) {
    return false;
  }

  return (
    firstStartMinutes < secondEndMinutes &&
    firstEndMinutes > secondStartMinutes
  );
}

async function createNotification(params: {
  userId: string;
  bookingId: string;
  title: string;
  message: string;
}) {
  const { error } = await supabaseAdmin
    .from("user_notifications")
    .insert({
      user_id: params.userId,
      booking_id: params.bookingId,
      type: "booking_created",
      title: params.title,
      message: params.message,
      href: `/bookings/${params.bookingId}`,
    });

  if (error) {
    console.error(
      "Booking notification error:",
      error.message
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      providerId?: string;
      serviceSlug?: string;
      bookingDate?: string;
      startTime?: string;
      endTime?: string;
      message?: string;
      quoteId?: string;
    };

    const providerId = body.providerId?.trim();
    const serviceSlug = body.serviceSlug?.trim();
    const bookingDate = body.bookingDate?.trim();
    const startTime = body.startTime?.trim().slice(0, 5);
    const endTime = body.endTime?.trim().slice(0, 5);
    const message =
      body.message?.trim().slice(0, 2000) || null;
    const quoteId = body.quoteId?.trim() || null;

    if (
      !providerId ||
      !serviceSlug ||
      !bookingDate ||
      !startTime ||
      !endTime
    ) {
      return NextResponse.json(
        {
          error:
            "Informations de réservation incomplètes.",
        },
        { status: 400 }
      );
    }

    if (providerId === profile.id) {
      return NextResponse.json(
        {
          error:
            "Tu ne peux pas réserver ton propre service.",
        },
        { status: 400 }
      );
    }

    if (
      !isValidCalendarDate(bookingDate) ||
      bookingDate < todayInBrussels()
    ) {
      return NextResponse.json(
        {
          error:
            "Il est impossible de réserver une date passée.",
        },
        { status: 400 }
      );
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return NextResponse.json(
        {
          error:
            "L’heure de fin doit être après l’heure de début.",
        },
        { status: 400 }
      );
    }

    if (isPastBookingStart(bookingDate, startTime)) {
      return NextResponse.json(
        {
          error:
            "Le début de la réservation doit être dans le futur selon l’heure de Bruxelles.",
        },
        { status: 400 }
      );
    }

    const {
      data: providerProfile,
      error: providerProfileError,
    } = await supabaseAdmin
      .from("provider_profiles")
      .select("profile_id, is_published")
      .eq("profile_id", providerId)
      .eq("is_published", true)
      .maybeSingle();

    if (providerProfileError) {
      throw new Error(providerProfileError.message);
    }

    if (!providerProfile) {
      return NextResponse.json(
        {
          error:
            "Cette fiche prestataire n’est pas publiée.",
        },
        { status: 404 }
      );
    }

    const { data: service, error: serviceError } =
      await supabaseAdmin
        .from("services")
        .select("id, slug")
        .eq("slug", serviceSlug)
        .maybeSingle();

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    if (!service) {
      return NextResponse.json(
        { error: "Service introuvable." },
        { status: 404 }
      );
    }

    const {
      data: userService,
      error: userServiceError,
    } = await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", providerId)
      .eq("service_id", service.id)
      .eq("active", true)
      .eq("provider_enabled", true)
      .maybeSingle();

    if (userServiceError) {
      throw new Error(userServiceError.message);
    }

    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Ce prestataire ne propose pas ce service.",
        },
        { status: 404 }
      );
    }

    const skillApproved =
      await isUserServiceApproved({
        profileId: providerId,
        userServiceId: userService.id,
      });

    if (!skillApproved) {
      return NextResponse.json(
        {
          error:
            "Ce métier n’est pas encore vérifié par KLYX et ne peut pas être réservé.",
        },
        { status: 409 }
      );
    }

    const {
      data: activeZone,
      error: activeZoneError,
    } = await supabaseAdmin
      .from("provider_service_zones")
      .select("id")
      .eq("profile_id", providerId)
      .eq("user_service_id", userService.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (activeZoneError) {
      throw new Error(activeZoneError.message);
    }

    if (!activeZone) {
      return NextResponse.json(
        {
          error:
            "Ce prestataire n’accepte pas encore de réservation pour ce service dans une zone active.",
        },
        { status: 409 }
      );
    }

    let acceptedQuote: AcceptedQuoteRow | null = null;

    if (quoteId) {
      const { data: quote, error: quoteError } =
        await supabaseAdmin
          .from("service_quotes")
          .select(
            "id, client_profile_id, provider_profile_id, user_service_id, requested_date, requested_time, duration_hours, pricing_type, provider_price, status, expires_at"
          )
          .eq("id", quoteId)
          .eq("client_profile_id", profile.id)
          .maybeSingle();

      if (quoteError) {
        throw new Error(quoteError.message);
      }

      if (!quote) {
        return NextResponse.json(
          { error: "Devis introuvable." },
          { status: 404 }
        );
      }

      acceptedQuote = quote as AcceptedQuoteRow;

      if (acceptedQuote.status !== "accepted") {
        return NextResponse.json(
          {
            error:
              "Seul un devis accepté peut être transformé en réservation.",
          },
          { status: 409 }
        );
      }

      if (
        acceptedQuote.provider_profile_id !== providerId ||
        acceptedQuote.user_service_id !== userService.id
      ) {
        return NextResponse.json(
          {
            error:
              "Le devis ne correspond pas à ce prestataire ou à ce métier.",
          },
          { status: 409 }
        );
      }

      if (
        acceptedQuote.expires_at &&
        new Date(acceptedQuote.expires_at).getTime() <
          Date.now()
      ) {
        return NextResponse.json(
          { error: "Ce devis a expiré." },
          { status: 409 }
        );
      }

      if (
        acceptedQuote.provider_price == null ||
        Number(acceptedQuote.provider_price) <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Le devis accepté ne contient pas de prix valide.",
          },
          { status: 409 }
        );
      }

      if (
        acceptedQuote.requested_date &&
        acceptedQuote.requested_date !== bookingDate
      ) {
        return NextResponse.json(
          {
            error:
              "La date doit correspondre au devis accepté.",
          },
          { status: 409 }
        );
      }

      if (
        acceptedQuote.requested_time &&
        acceptedQuote.requested_time.slice(0, 5) !==
          startTime
      ) {
        return NextResponse.json(
          {
            error:
              "L’heure de début doit correspondre au devis accepté.",
          },
          { status: 409 }
        );
      }

      if (acceptedQuote.duration_hours != null) {
        const durationHours =
          (endMinutes - startMinutes) / 60;

        if (
          Math.abs(
            durationHours -
              Number(acceptedQuote.duration_hours)
          ) > 0.01
        ) {
          return NextResponse.json(
            {
              error:
                "La durée doit correspondre au devis accepté.",
            },
            { status: 409 }
          );
        }
      }

      const {
        data: bookingAlreadyCreated,
        error: existingQuoteBookingError,
      } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("quote_id", acceptedQuote.id)
        .maybeSingle();

      if (existingQuoteBookingError) {
        throw new Error(
          existingQuoteBookingError.message
        );
      }

      if (bookingAlreadyCreated) {
        return NextResponse.json(
          {
            error:
              "Ce devis a déjà été utilisé pour une réservation.",
            bookingId: bookingAlreadyCreated.id,
          },
          { status: 409 }
        );
      }
    }

    const [
      {
        data: serviceProfile,
        error: serviceProfileError,
      },
      availabilityResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("service_profiles")
        .select("available, price, pricing_type")
        .eq("user_service_id", userService.id)
        .maybeSingle(),
      supabaseAdmin
        .from("availability_slots")
        .select(
          "day_of_week, start_time, end_time, is_active"
        )
        .eq("user_service_id", userService.id)
        .eq("is_active", true),
    ]);

    if (serviceProfileError) {
      throw new Error(serviceProfileError.message);
    }

    if (availabilityResult.error) {
      throw new Error(
        availabilityResult.error.message
      );
    }

    if (
      !serviceProfile?.available ||
      serviceProfile.price == null
    ) {
      return NextResponse.json(
        {
          error:
            "Ce service n’est pas disponible actuellement.",
        },
        { status: 400 }
      );
    }

    const dayOfWeek = new Date(
      `${bookingDate}T12:00:00Z`
    ).getUTCDay();

    const slots =
      (availabilityResult.data ?? []) as AvailabilityRow[];

    const insideAvailability = slots.some((slot) => {
      const slotStart = timeToMinutes(slot.start_time);
      const slotEnd = timeToMinutes(slot.end_time);

      return (
        Number(slot.day_of_week) === dayOfWeek &&
        slot.is_active !== false &&
        slotStart !== null &&
        slotEnd !== null &&
        startMinutes >= slotStart &&
        endMinutes <= slotEnd
      );
    });

    if (!insideAvailability) {
      return NextResponse.json(
        {
          error:
            "Ce créneau ne correspond pas aux disponibilités du prestataire.",
        },
        { status: 400 }
      );
    }

    const {
      data: existingBookings,
      error: existingError,
    } = await supabaseAdmin
      .from("bookings")
      .select("id, start_time, end_time")
      .eq("parent_id", profile.id)
      .eq("booking_date", bookingDate)
      .in("status", ["pending", "accepted"]);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const clientHasConflict = (
      (existingBookings ?? []) as ExistingBookingRow[]
    ).some((booking) =>
      overlaps(
        startTime,
        endTime,
        booking.start_time,
        booking.end_time
      )
    );

    if (clientHasConflict) {
      return NextResponse.json(
        {
          error:
            "Tu as déjà une demande ou une réservation sur ce créneau.",
        },
        { status: 409 }
      );
    }

    const durationMinutes =
      endMinutes - startMinutes;

    let pricingType: PricingType;
    let unitPriceCents: number;
    let estimatedAmountCents: number;

    if (acceptedQuote) {
      pricingType =
        acceptedQuote.pricing_type === "fixed"
          ? "fixed"
          : "hourly";

      estimatedAmountCents = Math.round(
        Number(acceptedQuote.provider_price) * 100
      );

      unitPriceCents =
        pricingType === "fixed"
          ? estimatedAmountCents
          : Math.round(
              estimatedAmountCents /
                (durationMinutes / 60)
            );
    } else {
      pricingType =
        serviceProfile.pricing_type === "fixed"
          ? "fixed"
          : "hourly";

      unitPriceCents = Math.round(
        Number(serviceProfile.price) * 100
      );

      estimatedAmountCents =
        pricingType === "fixed"
          ? unitPriceCents
          : Math.round(
              unitPriceCents *
                (durationMinutes / 60)
            );
    }

    if (
      unitPriceCents <= 0 ||
      estimatedAmountCents <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Le tarif du service doit être corrigé par le prestataire.",
        },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } =
      await supabaseAdmin
        .from("bookings")
        .insert({
          parent_id: profile.id,
          babysitter_id: providerId,
          provider_id: providerId,
          service_id: service.id,
          user_service_id: userService.id,
          quote_id: acceptedQuote?.id ?? null,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          message,
          status: "pending",
          payment_status: "unpaid",
          service_status: "scheduled",
          pricing_type_snapshot: pricingType,
          unit_price_cents: unitPriceCents,
          estimated_amount_cents:
            estimatedAmountCents,
          amount_total: estimatedAmountCents,
          currency: "EUR",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

    if (bookingError) {
      throw new Error(bookingError.message);
    }

    const { error: eventError } =
      await supabaseAdmin
        .from("booking_status_events")
        .insert({
          booking_id: booking.id,
          actor_id: profile.id,
          previous_status: null,
          new_status: "pending",
          note: acceptedQuote
            ? "Demande créée depuis un devis accepté."
            : "Demande envoyée par le client.",
        });

    if (eventError) {
      console.error(
        "Booking event error:",
        eventError.message
      );
    }

    await createNotification({
      userId: providerId,
      bookingId: booking.id,
      title: "Nouvelle demande reçue",
      message: `${serviceLabel(
        service.slug
      )} demandé pour le ${bookingDate} de ${startTime} à ${endTime}.`,
    });

    return NextResponse.json({
      bookingId: booking.id,
      estimatedAmountCents,
      quoteApplied: Boolean(acceptedQuote),
      message: acceptedQuote
        ? "Réservation créée avec le prix du devis accepté."
        : "Demande de réservation envoyée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de créer la réservation.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}



