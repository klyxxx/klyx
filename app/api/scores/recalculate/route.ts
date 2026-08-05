import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

type BookingRow = {
  babysitter_id: string;
  status: string;
};

type UserServiceRow = {
  id: string;
  user_id: string;
};

function calculateScore(params: {
  completedJobs: number;
  cancelledJobs: number;
  totalJobs: number;
}): number {
  const { completedJobs, cancelledJobs, totalJobs } = params;

  const activityScore = Math.min(completedJobs * 2, 20);

  const completionRate =
    totalJobs > 0 ? completedJobs / totalJobs : 0;

  const completionScore = completionRate * 20;

  const cancellationRate =
    totalJobs > 0 ? cancelledJobs / totalJobs : 0;

  const reliabilityScore = Math.max(
    0,
    10 - cancellationRate * 10
  );

  const baseScore = 50;

  return Math.min(
    100,
    Number(
      (
        baseScore +
        activityScore +
        completionScore +
        reliabilityScore
      ).toFixed(2)
    )
  );
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { data: service, error: serviceError } =
      await supabaseAdmin
        .from("services")
        .select("id")
        .eq("slug", "babysitting")
        .maybeSingle();

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    if (!service) {
      return NextResponse.json(
        { error: "Service baby-sitting introuvable." },
        { status: 404 }
      );
    }

    const { data: userServicesData, error: userServicesError } =
      await supabaseAdmin
        .from("user_services")
        .select("id, user_id")
        .eq("service_id", service.id)
        .eq("active", true);

    if (userServicesError) {
      throw new Error(userServicesError.message);
    }

    const userServices =
      (userServicesData ?? []) as UserServiceRow[];

    if (userServices.length === 0) {
      return NextResponse.json({
        updated: 0,
      });
    }

    const providerIds = userServices.map(
      (item) => item.user_id
    );

    const { data: bookingsData, error: bookingsError } =
      await supabaseAdmin
        .from("bookings")
        .select("babysitter_id, status")
        .in("babysitter_id", providerIds);

    if (bookingsError) {
      throw new Error(bookingsError.message);
    }

    const bookings =
      (bookingsData ?? []) as BookingRow[];

    let updated = 0;

    for (const userService of userServices) {
      const providerBookings = bookings.filter(
        (booking) =>
          booking.babysitter_id === userService.user_id
      );

      const completedJobs = providerBookings.filter(
        (booking) => booking.status === "completed"
      ).length;

      const cancelledJobs = providerBookings.filter(
        (booking) => booking.status === "cancelled"
      ).length;

      const totalJobs = providerBookings.length;

      const cancellationRate =
        totalJobs > 0
          ? Number(
              (
                (cancelledJobs / totalJobs) *
                100
              ).toFixed(2)
            )
          : 0;

      const klyxScore = calculateScore({
        completedJobs,
        cancelledJobs,
        totalJobs,
      });

      const { error: updateError } =
        await supabaseAdmin
          .from("service_profiles")
          .update({
            klyx_score: klyxScore,
            completed_jobs: completedJobs,
            cancellation_rate: cancellationRate,
            last_score_at: new Date().toISOString(),
          })
          .eq("user_service_id", userService.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      updated += 1;
    }

    return NextResponse.json({
      updated,
      message: "Scores KLYX recalculés.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de recalculer les scores.";

    const status = apiErrorStatus(message);

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
