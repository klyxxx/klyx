import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const { id } = await context.params;
    const quoteId = id.trim();

    const { data: quote, error } =
      await supabaseAdmin
        .from("service_quotes")
        .select(
          "id, client_profile_id, provider_profile_id, user_service_id, title, description, requested_date, requested_time, duration_hours, pricing_type, estimated_total, provider_price, provider_message, status, expires_at, accepted_at"
        )
        .eq("id", quoteId)
        .eq("client_profile_id", profile.id)
        .maybeSingle();

    if (error) throw new Error(error.message);

    if (!quote) {
      return NextResponse.json(
        { error: "Devis introuvable." },
        { status: 404 }
      );
    }

    const { data: userService, error: serviceError } =
      await supabaseAdmin
        .from("user_services")
        .select("id, user_id, services(id, slug, name)")
        .eq("id", quote.user_service_id)
        .eq("user_id", quote.provider_profile_id)
        .maybeSingle();

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Le métier lié à ce devis n’est plus disponible.",
        },
        { status: 409 }
      );
    }

    const relation = Array.isArray(userService.services)
      ? userService.services[0]
      : userService.services;

    const { data: provider, error: providerError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .eq("id", quote.provider_profile_id)
        .maybeSingle();

    if (providerError) {
      throw new Error(providerError.message);
    }

    const { data: existingBooking, error: bookingError } =
      await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("quote_id", quote.id)
        .maybeSingle();

    if (bookingError) {
      throw new Error(bookingError.message);
    }

    return NextResponse.json({
      quote: {
        ...quote,
        serviceSlug: relation?.slug ?? null,
        serviceName: relation?.name ?? "Service KLYX",
        provider,
        bookingId: existingBooking?.id ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger le devis.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
