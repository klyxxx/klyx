import { supabase } from "./supabase";

export type MobileNotification = {
  id: string;
  type: string | null;
  title: string;
  message: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type MobileBooking = {
  id: string;
  parent_id: string | null;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_date: string | null;
  start_time: string | null;
  status: string;
  payment_status: string | null;
};

export async function listNotifications(profileId: string) {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, type, title, message, href, read_at, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as MobileNotification[];
}

export async function listBookings(profileId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, booking_date, start_time, status, payment_status"
    )
    .or(
      `parent_id.eq.${profileId},provider_id.eq.${profileId},babysitter_id.eq.${profileId}`
    )
    .order("booking_date", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as MobileBooking[];
}
