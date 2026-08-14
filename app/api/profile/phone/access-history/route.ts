import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_PHONE_ACCESS_HISTORY_API_12_76

type AccessLogRow = {
  id: string;
  booking_id: string;
  viewer_profile_id: string;
  contact_profile_id: string;
  event_type: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type BookingRow = {
  id: string;
  status: string;
  service_id: string | null;
};

type ServiceRow = {
  id: string;
  slug: string;
};

function displayName(
  profile: ProfileRow | undefined
) {
  if (!profile) {
    return "Utilisateur KLYX";
  }

  return (
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Utilisateur KLYX"
  );
}

function eventLabel(eventType: string) {
  if (eventType === "phone_explicit_reveal") {
    return "Numero affiche";
  }

  if (eventType === "phone_call_started") {
    return "Appel lance";
  }

  if (eventType === "phone_reveal") {
    return "Numero consulte";
  }

  return "Acces telephone";
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const {
      data: logsData,
      error: logsError,
    } = await supabaseAdmin
      .from("phone_contact_access_logs")
      .select(
        "id, booking_id, viewer_profile_id, contact_profile_id, event_type, created_at"
      )
      .eq("contact_profile_id", profile.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(30);

    if (logsError) {
      throw new Error(logsError.message);
    }

    const logs =
      (logsData ?? []) as AccessLogRow[];

    if (logs.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
      });
    }

    const viewerIds = Array.from(
      new Set(
        logs.map(
          (item) => item.viewer_profile_id
        )
      )
    );

    const bookingIds = Array.from(
      new Set(
        logs.map(
          (item) => item.booking_id
        )
      )
    );

    const [profilesResult, bookingsResult] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select(
            "id, first_name, last_name"
          )
          .in("id", viewerIds),

        supabaseAdmin
          .from("bookings")
          .select(
            "id, status, service_id"
          )
          .in("id", bookingIds),
      ]);

    if (profilesResult.error) {
      throw new Error(
        profilesResult.error.message
      );
    }

    if (bookingsResult.error) {
      throw new Error(
        bookingsResult.error.message
      );
    }

    const profiles =
      (profilesResult.data ?? []) as ProfileRow[];

    const bookings =
      (bookingsResult.data ?? []) as BookingRow[];

    const serviceIds = Array.from(
      new Set(
        bookings
          .map((item) => item.service_id)
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      )
    );

    let services: ServiceRow[] = [];

    if (serviceIds.length > 0) {
      const {
        data: servicesData,
        error: servicesError,
      } = await supabaseAdmin
        .from("services")
        .select("id, slug")
        .in("id", serviceIds);

      if (servicesError) {
        throw new Error(
          servicesError.message
        );
      }

      services =
        (servicesData ?? []) as ServiceRow[];
    }

    const profileMap = new Map(
      profiles.map(
        (item) => [item.id, item]
      )
    );

    const bookingMap = new Map(
      bookings.map(
        (item) => [item.id, item]
      )
    );

    const serviceMap = new Map(
      services.map(
        (item) => [item.id, item]
      )
    );

    const items = logs.map((log) => {
      const viewer =
        profileMap.get(
          log.viewer_profile_id
        );

      const booking =
        bookingMap.get(log.booking_id);

      const service =
        booking?.service_id
          ? serviceMap.get(
              booking.service_id
            )
          : undefined;

      return {
        id: log.id,
        bookingId: log.booking_id,
        viewerName:
          displayName(viewer),
        eventType: log.event_type,
        eventLabel:
          eventLabel(log.event_type),
        createdAt: log.created_at,
        bookingStatus:
          booking?.status ?? null,
        serviceSlug:
          service?.slug ?? null,
      };
    });

    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Historique telephone indisponible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}