import "server-only";

import type { AuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  refund_status: string | null;
  amount_total: number | null;
  estimated_amount_cents: number | null;
  currency: string | null;
  created_at: string;
};

type BookingGroupRow = {
  id: string;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  refund_status: string;
  total_amount_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type VerificationRow = {
  profile_id: string;
  status: string | null;
  identity_status: string | null;
  address_status: string | null;
  trust_level: string | null;
  external_provider: string | null;
  external_review_status: string | null;
  external_review_answer: string | null;
  external_reject_type: string | null;
  external_sandbox_mode: boolean | null;
  external_updated_at: string | null;
};

export type AssistantBookingSnapshot = {
  id: string;
  entityType: "booking" | "group";
  href: string;
  status: string;
  paymentStatus: string;
  refundStatus: string;
  amountCents: number | null;
  currency: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
};

export type AssistantKycSnapshot = {
  profileId: string;
  status: string;
  identityStatus: string;
  addressStatus: string;
  trustLevel: string;
  provider: string;
  reviewStatus: string;
  reviewAnswer: string;
  rejectType: string;
  sandboxMode: boolean;
  updatedAt: string | null;
};

function profileIds(profiles: readonly AuthenticatedProfile[]): string[] {
  return [...new Set(profiles.map((profile) => profile.id).filter(Boolean))];
}

function newest<T extends { createdAt: string }>(
  values: readonly T[]
): T | null {
  return (
    [...values].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )[0] ?? null
  );
}

function bookingOrFilter(ids: readonly string[]): string {
  return ids
    .flatMap((id) => [
      `parent_id.eq.${id}`,
      `provider_id.eq.${id}`,
      `babysitter_id.eq.${id}`,
    ])
    .join(",");
}

function groupOrFilter(ids: readonly string[]): string {
  return ids
    .flatMap((id) => [
      `client_profile_id.eq.${id}`,
      `provider_profile_id.eq.${id}`,
    ])
    .join(",");
}

export async function loadLatestAssistantBooking(
  profiles: readonly AuthenticatedProfile[]
): Promise<AssistantBookingSnapshot | null> {
  const ids = profileIds(profiles);
  if (ids.length === 0) return null;

  const [bookingResult, groupResult] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, booking_group_id, booking_date, start_time, end_time, status, payment_status, refund_status, amount_total, estimated_amount_cents, currency, created_at"
      )
      .or(bookingOrFilter(ids))
      .is("booking_group_id", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("booking_groups")
      .select(
        "id, client_profile_id, provider_profile_id, status, payment_status, refund_status, total_amount_cents, currency, created_at, updated_at"
      )
      .or(groupOrFilter(ids))
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (bookingResult.error) throw new Error(bookingResult.error.message);
  if (groupResult.error) throw new Error(groupResult.error.message);

  const bookings = (bookingResult.data ?? []) as unknown as BookingRow[];
  const groups = (groupResult.data ?? []) as unknown as BookingGroupRow[];

  const candidates: AssistantBookingSnapshot[] = [
    ...bookings.map((booking) => ({
      id: booking.id,
      entityType: "booking" as const,
      href: `/bookings/${booking.id}`,
      status: booking.status,
      paymentStatus: booking.payment_status ?? "unpaid",
      refundStatus: booking.refund_status ?? "not_required",
      amountCents: booking.estimated_amount_cents ?? booking.amount_total,
      currency: String(booking.currency ?? "").trim().toUpperCase(),
      date: booking.booking_date || null,
      startTime: booking.start_time || null,
      endTime: booking.end_time || null,
      createdAt: booking.created_at,
    })),
    ...groups.map((group) => ({
      id: group.id,
      entityType: "group" as const,
      href: `/booking-groups/${group.id}`,
      status: group.status,
      paymentStatus: group.payment_status,
      refundStatus: group.refund_status,
      amountCents: Number.isFinite(Number(group.total_amount_cents))
        ? Number(group.total_amount_cents)
        : null,
      currency: String(group.currency ?? "").trim().toUpperCase(),
      date: null,
      startTime: null,
      endTime: null,
      createdAt: group.created_at,
    })),
  ];

  return newest(candidates);
}

export async function loadAssistantKyc(
  profiles: readonly AuthenticatedProfile[]
): Promise<AssistantKycSnapshot | null> {
  const ids = profileIds(profiles);
  if (ids.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("provider_verifications")
    .select(
      "profile_id, status, identity_status, address_status, trust_level, external_provider, external_review_status, external_review_answer, external_reject_type, external_sandbox_mode, external_updated_at"
    )
    .in("profile_id", ids)
    .limit(20);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as VerificationRow[];
  const row = [...rows].sort((left, right) =>
    String(right.external_updated_at ?? "").localeCompare(
      String(left.external_updated_at ?? "")
    )
  )[0];

  if (!row) return null;

  return {
    profileId: row.profile_id,
    status: row.status ?? "unknown",
    identityStatus: row.identity_status ?? "unknown",
    addressStatus: row.address_status ?? "unknown",
    trustLevel: row.trust_level ?? "unknown",
    provider: row.external_provider ?? "sumsub",
    reviewStatus: row.external_review_status ?? "unknown",
    reviewAnswer: row.external_review_answer ?? "unknown",
    rejectType: row.external_reject_type ?? "",
    sandboxMode: row.external_sandbox_mode === true,
    updatedAt: row.external_updated_at,
  };
}
