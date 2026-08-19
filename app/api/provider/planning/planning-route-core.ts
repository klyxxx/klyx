import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  analyzeProviderPlanning,
  type PlanningAvailability,
  type PlanningBooking,
} from "@/lib/provider-planning";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const url = new URL(request.url);
    const daysValue = Number(
      url.searchParams.get("days") ?? 30
    );
    const days =
      Number.isInteger(daysValue) &&
      daysValue >= 7 &&
      daysValue <= 90
        ? daysValue
        : 30;

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days);

    const { data: userServices, error: userServiceError } =
      await supabaseAdmin
        .from("user_services")
        .select("id")
        .eq("user_id", profile.id)
        .eq("provider_enabled", true);

    if (userServiceError) {
      throw new Error(userServiceError.message);
    }

    const userServiceIds = (userServices ?? []).map(
      (service) => service.id
    );

    const [bookingsResult, availabilityResult] =
      await Promise.all([
        supabaseAdmin
          .from("bookings")
          .select(
            "id, parent_id, booking_date, start_time, end_time, status, service_status"
          )
          .or(
            `provider_id.eq.${profile.id},babysitter_id.eq.${profile.id}`
          )
          .gte("booking_date", isoDate(start))
          .lte("booking_date", isoDate(end))
          .in("status", [
            "pending",
            "accepted",
            "completed",
          ])
          .order("booking_date", { ascending: true })
          .order("start_time", { ascending: true }),
        userServiceIds.length > 0
          ? supabaseAdmin
              .from("availability_slots")
              .select(
                "day_of_week, start_time, end_time"
              )
              .in("user_service_id", userServiceIds)
              .eq("is_active", true)
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

    if (bookingsResult.error) {
      throw new Error(bookingsResult.error.message);
    }

    if (availabilityResult.error) {
      throw new Error(availabilityResult.error.message);
    }

    const parentIds = [
      ...new Set(
        (bookingsResult.data ?? []).map(
          (booking) => booking.parent_id
        )
      ),
    ];

    const { data: clients, error: clientsError } =
      parentIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", parentIds)
        : { data: [], error: null };

    if (clientsError) {
      throw new Error(clientsError.message);
    }

    const clientNames = new Map(
      (clients ?? []).map((client) => [
        client.id,
        `${client.first_name ?? ""} ${
          client.last_name ?? ""
        }`.trim() || "Client KLYX",
      ])
    );

    const bookings: PlanningBooking[] = (
      bookingsResult.data ?? []
    ).map((booking) => ({
      id: booking.id,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      status: booking.status,
      serviceStatus: booking.service_status,
      clientName:
        clientNames.get(booking.parent_id) ??
        "Client KLYX",
    }));

    const availability: PlanningAvailability[] = (
      availabilityResult.data ?? []
    ).map((slot) => ({
      dayOfWeek: Number(slot.day_of_week),
      startTime: slot.start_time,
      endTime: slot.end_time,
    }));

    const planning = analyzeProviderPlanning(
      bookings,
      availability
    );

    return NextResponse.json({
      planning,
      range: {
        start: isoDate(start),
        end: isoDate(end),
        days,
      },
      summary: {
        bookingCount: bookings.length,
        warningCount: planning.reduce(
          (total, day) => total + day.warnings.length,
          0
        ),
        highWarningCount: planning.reduce(
          (total, day) =>
            total +
            day.warnings.filter(
              (warning) => warning.severity === "high"
            ).length,
          0
        ),
      },
      automaticChanges: false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger le planning.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
