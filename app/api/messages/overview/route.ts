import { NextResponse } from "next/server";

import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_MESSAGES_OVERVIEW_SERVER_BOUNDARY_2026_09_02

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type BookingRow = {
  id: string;
  parent_id: string;
  babysitter_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ConversationAccumulator = {
  latestMessage: MessageRow;
  unreadCount: number;
};

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const profileId = profile.id;

    const { data: messageData, error: messageError } = await supabaseAdmin
      .from("messages")
      .select(
        "id, booking_id, sender_id, receiver_id, message, is_read, created_at"
      )
      .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (messageError) {
      throw new Error(messageError.message);
    }

    const messages = (messageData ?? []) as MessageRow[];

    if (messages.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const grouped = new Map<string, ConversationAccumulator>();

    for (const message of messages) {
      const current = grouped.get(message.booking_id);

      if (!current) {
        grouped.set(message.booking_id, {
          latestMessage: message,
          unreadCount:
            message.receiver_id === profileId && !message.is_read ? 1 : 0,
        });
        continue;
      }

      if (message.receiver_id === profileId && !message.is_read) {
        current.unreadCount += 1;
      }
    }

    const bookingIds = Array.from(grouped.keys());
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, babysitter_id, booking_date, start_time, end_time, status"
      )
      .in("id", bookingIds);

    if (bookingError) {
      throw new Error(bookingError.message);
    }

    const bookings = ((bookingData ?? []) as BookingRow[]).filter(
      (booking) =>
        booking.parent_id === profileId || booking.babysitter_id === profileId
    );

    const otherProfileIds = Array.from(
      new Set(
        bookings.map((booking) =>
          booking.parent_id === profileId
            ? booking.babysitter_id
            : booking.parent_id
        )
      )
    );

    let profiles: ProfileRow[] = [];

    if (otherProfileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, first_name, last_name, avatar_url")
        .in("id", otherProfileIds);

      if (profileError) {
        throw new Error(profileError.message);
      }

      profiles = (profileData ?? []) as ProfileRow[];
    }

    const profileById = new Map(profiles.map((item) => [item.id, item]));
    const conversations = bookings.flatMap((booking) => {
      const aggregate = grouped.get(booking.id);

      if (!aggregate) {
        return [];
      }

      const otherProfileId =
        booking.parent_id === profileId
          ? booking.babysitter_id
          : booking.parent_id;

      return [
        {
          booking,
          latestMessage: aggregate.latestMessage,
          otherProfile: profileById.get(otherProfileId) ?? null,
          unreadCount: aggregate.unreadCount,
          latestIsMine: aggregate.latestMessage.sender_id === profileId,
        },
      ];
    });

    conversations.sort(
      (left, right) =>
        new Date(right.latestMessage.created_at).getTime() -
        new Date(left.latestMessage.created_at).getTime()
    );

    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    const status = apiErrorStatus(message);

    return NextResponse.json(
      {
        error:
          status >= 500
            ? "Impossible de charger les conversations."
            : message,
      },
      { status }
    );
  }
}
