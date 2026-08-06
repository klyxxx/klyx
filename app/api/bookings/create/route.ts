import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
  const { error } = await supabaseAdmin.from("user_notifications").insert({
    user_id: params.userId,
    booking_id: params.bookingId,
    type: "booking_created",
    title: params.title,
    message: params.message,
    href: `/bookings/${params.bookingId}`,
  });

  if (error) {
    console.error("Booking notification error:", error.message);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      providerId?: string;
      serviceSlug?: string;
      bookingDate?: string;
      startTime?: string;
      endTime?: string;
      message?: string;
    };

    const providerId = body.providerId?.trim();
    const serviceSlug = body.serviceSlug?.trim();
    const bookingDate = body.bookingDate?.trim();
    const startTime = body.startTime?.trim().slice(0, 5);
    const endTime = body.endTime?.trim().slice(0, 5);
    const message = body.message?.trim().slice(0, 2000) || null;

    if (
      !providerId ||
      !serviceSlug ||
      !bookingDate ||
      !startTime ||
      !endTime
    ) {
      return NextResponse.json(
        { error: "Informations de réservation incomplètes." },
        { status: 400 }
      );
    }

    if (providerId === profile.id) {
      return NextResponse.json(
        { error: "Tu ne peux pas réserver ton propre service." },
        { status: 400 }
      );
    }

    if (
      !isValidCalendarDate(bookingDate) ||
      bookingDate < todayInBrussels()
    ) {
      return NextResponse.json(
        { error: "Il est impossible de réserver une date passée." },
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
        { error: "L’heure de fin doit être après l’heure de début." },
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

    const { data: providerProfile, error: providerProfileError } =
      await supabaseAdmin
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
        { error: "Cette fiche prestataire n’est pas publiée." },
        { status: 404 }
      );
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, slug")
      .eq("slug", serviceSlug)
      .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);

    if (!service) {
      return NextResponse.json(
        { error: "Service introuvable." },
        { status: 404 }
      );
    }

    const { data: userService, error: userServiceError } =
      await supabaseAdmin
        .from("user_services")
        .select("id")
        .eq("user_id", providerId)
        .eq("service_id", service.id)
        .eq("active", true)
        .eq("provider_enabled", true)
        .maybeSingle();

    if (userServiceError) throw new Error(userServiceError.message);

    if (!userService) {
      return NextResponse.json(
        { error: "Ce prestataire ne propose pas ce service." },
        { status: 404 }
      );
    }

    const [
      { data: serviceProfile, error: serviceProfileError },
      availabilityResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("service_profiles")
        .select("available, price, pricing_type")
        .eq("user_service_id", userService.id)
        .maybeSingle(),
      supabaseAdmin
        .from("availability_slots")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("user_service_id", userService.id)
        .eq("is_active", true),
    ]);

    if (serviceProfileError) {
      throw new Error(serviceProfileError.message);
    }

    if (availabilityResult.error) {
      throw new Error(availabilityResult.error.message);
    }

    if (!serviceProfile?.available || serviceProfile.price == null) {
      return NextResponse.json(
        { error: "Ce service n’est pas disponible actuellement." },
        { status: 400 }
      );
    }

    const dayOfWeek = new Date(
      `${bookingDate}T12:00:00Z`
    ).getUTCDay();
    const slots = (availabilityResult.data ?? []) as AvailabilityRow[];

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

    const { data: existingBookings, error: existingError } =
      await supabaseAdmin
        .from("bookings")
        .select("id, start_time, end_time")
        .eq("parent_id", profile.id)
        .eq("booking_date", bookingDate)
        .in("status", ["pending", "accepted"]);

    if (existingError) throw new Error(existingError.message);

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

    const pricingType: PricingType =
      serviceProfile.pricing_type === "fixed" ? "fixed" : "hourly";
    const unitPriceCents = Math.round(
      Number(serviceProfile.price) * 100
    );
    const durationMinutes = endMinutes - startMinutes;
    const estimatedAmountCents =
      pricingType === "fixed"
        ? unitPriceCents
        : Math.round(unitPriceCents * (durationMinutes / 60));

    if (unitPriceCents <= 0 || estimatedAmountCents <= 0) {
      return NextResponse.json(
        {
          error:
            "Le tarif du service doit être corrigé par le prestataire.",
        },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        parent_id: profile.id,
        babysitter_id: providerId,
        provider_id: providerId,
        service_id: service.id,
        user_service_id: userService.id,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        message,
        status: "pending",
        payment_status: "unpaid",
        service_status: "scheduled",
        pricing_type_snapshot: pricingType,
        unit_price_cents: unitPriceCents,
        estimated_amount_cents: estimatedAmountCents,
        amount_total: estimatedAmountCents,
        currency: "EUR",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (bookingError) throw new Error(bookingError.message);

    const { error: eventError } = await supabaseAdmin
      .from("booking_status_events")
      .insert({
        booking_id: booking.id,
        actor_id: profile.id,
        previous_status: null,
        new_status: "pending",
        note: "Demande envoyée par le client.",
      });

    if (eventError) {
      console.error("Booking event error:", eventError.message);
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
      message: "Demande de réservation envoyée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de créer la réservation.";
    const status = apiErrorStatus(message);

    return NextResponse.json({ error: message }, { status });
  }
}
