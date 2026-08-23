// KLYX_BOOKING_DETAIL_CURRENCY_PHASE_5G
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  MapPin,
  MessageCircle,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";

import BookingContactCard from "@/app/components/BookingContactCard";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxBookingDetailAmount,
  formatKlyxBookingDetailDate,
  formatKlyxBookingDetailDateTime,
  formatKlyxBookingDetailStatus,
  formatKlyxBookingEventNote,
  formatKlyxBookingNextDescription,
  formatKlyxBookingNextTitle,
  formatKlyxBookingPaymentLabel,
  klyxBookingCheckoutErrorKey,
  klyxBookingStatusErrorKey,
  klyxBookingStatusSuccessKey,
  translateKlyxBookingDetail,
  type KlyxBookingDetailMessageKey,
} from "@/lib/klyx-booking-detail-i18n";
import { formatKlyxBookingServiceFromSlug } from "@/lib/klyx-bookings-service-i18n";
import { getActiveClientProfile, type SavedAccount } from "@/lib/account-switcher";
import { supabase } from "@/lib/supabase";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  message: string | null;
  status: string;
  payment_status: string | null;
  refund_status: string | null;
  service_status: string | null;
  pricing_type_snapshot: string | null;
  unit_price_cents: number | null;
  estimated_amount_cents: number | null;
  amount_total: number | null;
  currency: string | null;
  payment_failure_message: string | null;
  provider_response: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ServiceRow = {
  id: string;
  slug: string;
};

type StatusEventRow = {
  id: string;
  actor_id: string | null;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

type TimelineEvent = StatusEventRow & {
  actorName: string;
};

type BookingStatusAction = "accepted" | "rejected" | "cancelled";
type JourneyState = "done" | "current" | "upcoming" | "stopped";

const BOOKING_NOT_FOUND = "KLYX_BOOKING_NOT_FOUND";
const BOOKING_ACCESS_DENIED = "KLYX_BOOKING_ACCESS_DENIED";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  accepted: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  cancelled:
    "border-border dark:border-zinc-700 bg-muted dark:bg-zinc-800 text-foreground/80 dark:text-zinc-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

function profileName(profile: ProfileRow | null | undefined): string {
  return [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const bookingId = params.id;
  const t = (key: KlyxBookingDetailMessageKey) =>
    translateKlyxBookingDetail(locale, key);

  const [activeProfile, setActiveProfile] = useState<SavedAccount | null>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [otherProfile, setOtherProfile] = useState<ProfileRow | null>(null);
  const [serviceSlug, setServiceSlug] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorKey, setErrorKey] =
    useState<KlyxBookingDetailMessageKey | null>(null);
  const [successKey, setSuccessKey] =
    useState<KlyxBookingDetailMessageKey | null>(() =>
      searchParams.get("created") === "1"
        ? "requestSent"
        : searchParams.get("payment") === "success"
          ? "paymentSuccess"
          : null
    );

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const profile = await getActiveClientProfile();
      const [bookingResult, eventsResult] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, parent_id, provider_id, babysitter_id, service_id, booking_date, start_time, end_time, message, status, payment_status, refund_status, service_status, pricing_type_snapshot, unit_price_cents, estimated_amount_cents, amount_total, currency, payment_failure_message, provider_response, cancellation_reason, cancelled_by, created_at, accepted_at, rejected_at, cancelled_at, completed_at"
          )
          .eq("id", bookingId)
          .maybeSingle(),
        supabase
          .from("booking_status_events")
          .select("id, actor_id, previous_status, new_status, note, created_at")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true }),
      ]);

      if (bookingResult.error) throw new Error(bookingResult.error.message);
      if (eventsResult.error) throw new Error(eventsResult.error.message);
      if (!bookingResult.data) throw new Error(BOOKING_NOT_FOUND);

      const bookingData = bookingResult.data as BookingRow;
      const providerId = bookingData.provider_id ?? bookingData.babysitter_id;
      const participant =
        bookingData.parent_id === profile.id || providerId === profile.id;

      if (!participant) throw new Error(BOOKING_ACCESS_DENIED);

      const otherProfileId =
        bookingData.parent_id === profile.id ? providerId : bookingData.parent_id;
      const statusEvents = (eventsResult.data ?? []) as StatusEventRow[];
      const profileIds = Array.from(
        new Set(
          [
            otherProfileId,
            profile.id,
            ...statusEvents.map((event) => event.actor_id),
          ].filter((value): value is string => Boolean(value))
        )
      );

      const [profilesResult, serviceResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", profileIds),
        bookingData.service_id
          ? supabase
              .from("services")
              .select("id, slug")
              .eq("id", bookingData.service_id)
              .maybeSingle()
          : Promise.resolve({ data: null as ServiceRow | null, error: null }),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (serviceResult.error) throw new Error(serviceResult.error.message);

      const profiles = (profilesResult.data ?? []) as ProfileRow[];
      const profileById = new Map(profiles.map((item) => [item.id, item]));
      const service = serviceResult.data as ServiceRow | null;

      setActiveProfile(profile);
      setBooking(bookingData);
      setOtherProfile(
        otherProfileId ? profileById.get(otherProfileId) ?? null : null
      );
      setServiceSlug(service?.slug ?? null);
      setEvents(
        statusEvents.map((event) => ({
          ...event,
          actorName: event.actor_id
            ? profileName(profileById.get(event.actor_id))
            : "KLYX",
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setErrorKey(
        message === BOOKING_NOT_FOUND
          ? "notFound"
          : message === BOOKING_ACCESS_DENIED
            ? "apiAccessDenied"
            : "loadFailed"
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBooking();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBooking]);

  const role = useMemo<"client" | "provider" | null>(() => {
    if (!booking || !activeProfile) return null;
    return booking.parent_id === activeProfile.id ? "client" : "provider";
  }, [activeProfile, booking]);

  async function updateStatus(status: BookingStatusAction) {
    setActiveAction(status);
    setErrorKey(null);
    setSuccessKey(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/bookings/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookingId, status, note }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
      };

      if (!response.ok) {
        setErrorKey(klyxBookingStatusErrorKey(result.error, result.code));
        return;
      }

      setNote("");
      setSuccessKey(klyxBookingStatusSuccessKey(result.message));
      await loadBooking();
    } catch {
      setErrorKey("actionFailed");
    } finally {
      setActiveAction(null);
    }
  }

  async function payBooking() {
    setActiveAction("pay");
    setErrorKey(null);
    setSuccessKey(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        setActiveAction(null);
        return;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        const result = (await response.json()) as {
          url?: string;
          error?: string;
          code?: string;
          alreadyPaid?: boolean;
          paymentPending?: boolean;
          splitMissionPayment?: boolean;
        };

        if (result.alreadyPaid) {
          setSuccessKey("paymentSuccess");
          await loadBooking();
          setActiveAction(null);
          return;
        }

        if (result.paymentPending && attempt < 4) {
          await new Promise((resolve) => window.setTimeout(resolve, 700));
          continue;
        }

        if (!response.ok || !result.url) {
          setErrorKey(
            result.paymentPending
              ? "checkoutRetry"
              : klyxBookingCheckoutErrorKey(result.error, result)
          );
          setActiveAction(null);
          return;
        }

        window.location.href = result.url;
        return;
      }

      setActiveAction(null);
    } catch {
      setErrorKey("paymentFailed");
      setActiveAction(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground dark:bg-zinc-950 dark:text-white">
        {t("loading")}
      </main>
    );
  }

  if (!booking || !activeProfile) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 text-foreground dark:bg-zinc-950 dark:text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          {t(errorKey ?? "notFound")}
        </div>
      </main>
    );
  }

  const amount = booking.estimated_amount_cents ?? booking.amount_total;
  const canProviderAnswer = role === "provider" && booking.status === "pending";
  const canCancel =
    ["pending", "accepted"].includes(booking.status) &&
    !(role === "provider" && booking.status === "pending");
  const canPay =
    role === "client" &&
    booking.status === "accepted" &&
    booking.payment_status !== "paid" &&
    booking.payment_status !== "refunded";
  const canTrack =
    booking.status === "accepted" && booking.payment_status === "paid";
  const otherName = profileName(otherProfile) || t("userFallback");
  const serviceLabel = formatKlyxBookingServiceFromSlug(
    locale,
    serviceSlug,
    "Baby-sitting"
  );
  const paymentLabel = formatKlyxBookingPaymentLabel(locale, {
    paymentStatus: booking.payment_status,
    refundStatus: booking.refund_status,
    paymentFailureMessage: booking.payment_failure_message,
    role,
  });
  const nextTitle = formatKlyxBookingNextTitle(locale, {
    status: booking.status,
    paymentStatus: booking.payment_status,
    role,
  });
  const nextDescription = formatKlyxBookingNextDescription(locale, {
    status: booking.status,
    paymentStatus: booking.payment_status,
    refundStatus: booking.refund_status,
    role,
  });

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-6xl">
        {/* KLYX_AI_FIRST_BOOKING_UI_15_01 */}
        {/* KLYX_BOOKING_NEXT_ACTION_13_69 */}
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-violet-500/20 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),rgba(76,29,149,0.04),transparent)]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                  {t("tracking")}
                </p>
                <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                  {nextTitle}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {nextDescription}
                </p>
              </div>

              {canPay && (
                <button
                  type="button"
                  disabled={activeAction === "pay"}
                  onClick={() => void payBooking()}
                  className="klyx-button shrink-0 lg:min-w-[220px]"
                >
                  {activeAction === "pay" ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <CreditCard size={17} />
                  )}
                  {t("payNow")}
                </button>
              )}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <JourneyStep
                number="1"
                label={t("journeyRequest")}
                state={
                  booking.status === "pending"
                    ? "current"
                    : booking.status === "rejected" ||
                        booking.status === "cancelled"
                      ? "stopped"
                      : "done"
                }
                locale={locale}
              />
              <JourneyStep
                number="2"
                label={t("journeyAcceptance")}
                state={
                  booking.status === "pending"
                    ? "upcoming"
                    : booking.status === "rejected" ||
                        booking.status === "cancelled"
                      ? "stopped"
                      : "done"
                }
                locale={locale}
              />
              <JourneyStep
                number="3"
                label={t("journeyPayment")}
                state={
                  booking.payment_status === "paid"
                    ? "done"
                    : booking.status === "accepted"
                      ? "current"
                      : booking.status === "rejected" ||
                          booking.status === "cancelled"
                        ? "stopped"
                        : "upcoming"
                }
                locale={locale}
              />
              <JourneyStep
                number="4"
                label={t("journeyService")}
                state={
                  booking.status === "completed"
                    ? "done"
                    : canTrack
                      ? "current"
                      : booking.status === "rejected" ||
                          booking.status === "cancelled"
                        ? "stopped"
                        : "upcoming"
                }
                locale={locale}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                {t("bookingPrefix")}: {formatKlyxBookingDetailStatus(locale, booking.status)}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                {t("paymentPrefix")}: {paymentLabel}
              </span>
              {canPay && (
                <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-violet-700 dark:text-violet-300">
                  {t("actionPayment")}
                </span>
              )}
              {canTrack && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {t("serviceReady")}
                </span>
              )}
            </div>

            {canPay && (
              <p className="mt-5 text-xs font-bold text-muted-foreground">
                {t("manualPaymentSafety")}
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
          >
            <ArrowLeft size={17} /> {t("backBookings")}
          </Link>
          <button
            type="button"
            onClick={() => void loadBooking()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-card dark:border-zinc-700 dark:bg-zinc-900"
          >
            <RefreshCw size={16} /> {t("refresh")}
          </button>
        </div>

        {successKey && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-200">
            <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
            {t(successKey)}
          </div>
        )}

        {errorKey && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {t(errorKey)}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
                    {serviceLabel}
                  </p>
                  <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                    {formatKlyxBookingDetailStatus(locale, booking.status)}
                  </h1>
                </div>
                <span
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    STATUS_STYLES[booking.status] ?? STATUS_STYLES.cancelled
                  }`}
                >
                  {formatKlyxBookingDetailStatus(locale, booking.status)}
                </span>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={<CalendarDays size={19} />}
                  label={t("date")}
                  value={formatKlyxBookingDetailDate(locale, booking.booking_date)}
                />
                <InfoItem
                  icon={<Clock3 size={19} />}
                  label={t("schedule")}
                  value={`${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`}
                />
                <InfoItem
                  icon={<CreditCard size={19} />}
                  label={t("payment")}
                  value={paymentLabel}
                />
                <InfoItem
                  icon={<MapPin size={19} />}
                  label={t("estimatedTotal")}
                  value={formatKlyxBookingDetailAmount(
                    locale,
                    amount,
                    booking.currency ?? ""
                  )}
                />
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-background p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                  {otherProfile?.avatar_url ? (
                    <img
                      src={otherProfile.avatar_url}
                      alt={otherName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound
                      className="text-muted-foreground dark:text-zinc-500"
                      size={24}
                    />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground dark:text-zinc-500">
                    {role === "client" ? t("provider") : t("client")}
                  </p>
                  <p className="font-bold">{otherName}</p>
                </div>
              </div>

              {/* KLYX_SECURE_CONTACT_UI_12_68B */}
              <BookingContactCard
                bookingId={booking.id}
                bookingStatus={booking.status}
                otherName={otherName}
              />

              {booking.message && (
                <div className="mt-6 rounded-2xl border border-border p-5 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-muted-foreground dark:text-zinc-400">
                    {t("clientRequest")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-200">
                    {booking.message}
                  </p>
                </div>
              )}

              {booking.provider_response && (
                <div className="mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                  <p className="text-sm font-semibold text-violet-300">
                    {t("providerResponse")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-200">
                    {booking.provider_response}
                  </p>
                </div>
              )}

              {booking.cancellation_reason && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                  <p className="text-sm font-semibold text-red-300">
                    {t("cancellationReason")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-200">
                    {booking.cancellation_reason}
                  </p>
                </div>
              )}

              {role === "client" &&
                booking.payment_status !== "paid" &&
                booking.payment_status !== "refunded" &&
                booking.payment_failure_message && (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                    <p className="text-sm font-semibold text-red-300">
                      {t("paymentDeclined")}
                    </p>
                    <p className="mt-2 text-zinc-200">
                      {booking.payment_failure_message}
                    </p>
                  </div>
                )}
            </section>

            <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <History className="text-violet-400" size={24} />
                <h2 className="text-2xl font-bold">{t("history")}</h2>
              </div>

              {events.length === 0 ? (
                <p className="mt-5 text-muted-foreground dark:text-zinc-400">
                  {t("noEvents")}
                </p>
              ) : (
                <div className="mt-6 space-y-5">
                  {events.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4">
                      {index < events.length - 1 && (
                        <span className="absolute left-[11px] top-7 h-[calc(100%+4px)] w-px bg-zinc-700" />
                      )}
                      <span className="relative mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-zinc-900 bg-violet-500" />
                      <div className="pb-3">
                        <p className="font-semibold">
                          {formatKlyxBookingDetailStatus(
                            locale,
                            event.new_status
                          )}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-500">
                          {event.actorName || t("userFallback")} ·{" "}
                          {formatKlyxBookingDetailDateTime(
                            locale,
                            event.created_at
                          )}
                        </p>
                        {event.note && (
                          <p className="mt-2 text-sm leading-6 text-foreground/80 dark:text-zinc-300">
                            {formatKlyxBookingEventNote(locale, event.note)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xl font-bold">{t("actions")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-zinc-400">
              {canProviderAnswer
                ? t("providerActionHelp")
                : t("genericActionHelp")}
            </p>

            {(canProviderAnswer || canCancel) && (
              <label className="mt-5 block">
                <span className="mb-2 block text-sm text-foreground/80 dark:text-zinc-300">
                  {canProviderAnswer
                    ? t("responseMessage")
                    : t("cancellationReasonLabel")}
                </span>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    canProviderAnswer
                      ? t("responsePlaceholder")
                      : t("cancellationPlaceholder")
                  }
                  className="w-full resize-none rounded-xl border border-border bg-background p-4 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            )}

            {canProviderAnswer && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => void updateStatus("accepted")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-700 disabled:opacity-50"
                >
                  <Check size={18} /> {t("accept")}
                </button>
                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => void updateStatus("rejected")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <X size={18} /> {t("reject")}
                </button>
              </div>
            )}

            {canPay && (
              <button
                type="button"
                disabled={activeAction !== null}
                onClick={() => void payBooking()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-4 font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                <CreditCard size={19} /> {t("payBooking")}
              </button>
            )}

            {canTrack && (
              <Link
                href={`/tracking/${booking.id}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-4 font-semibold hover:bg-violet-700"
              >
                <MapPin size={19} /> {t("trackService")}
              </Link>
            )}

            <Link
              href={`/messages/${booking.id}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-muted dark:border-zinc-700 dark:bg-zinc-800"
            >
              <MessageCircle size={18} /> {t("openMessages")}
            </Link>

            {canCancel && (
              <button
                type="button"
                disabled={activeAction !== null}
                onClick={() => void updateStatus("cancelled")}
                className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {t("cancelBooking")}
              </button>
            )}

            {!canProviderAnswer && !canPay && !canTrack && !canCancel && (
              <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                {t("noMoreActions")}
              </div>
            )}
          </aside>
        </div>

        {/* KLYX_VERIFIED_REVIEW_CTA_13_70 */}
        {role === "client" && booking.status === "completed" && (
          <section className="mb-6 overflow-hidden rounded-3xl border border-amber-500/25 bg-amber-500/5">
            <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                  {t("verifiedReview")}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  {t("reviewQuestion")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("reviewDescription")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold">
                    {t("missionCompleted")}
                  </span>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {t("bookingVerified")}
                  </span>
                </div>
              </div>

              <Link
                href={`/reviews/${booking.id}`}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-700"
              >
                {t("leaveReview")}
              </Link>
            </div>
            <div className="border-t border-amber-500/15 px-6 py-4 text-xs leading-5 text-muted-foreground sm:px-8">
              {t("reviewAvailable")}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="flex items-center gap-2 text-sm text-muted-foreground dark:text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-2 font-semibold capitalize">{value}</p>
    </div>
  );
}

function JourneyStep({
  number,
  label,
  state,
  locale,
}: {
  number: string;
  label: string;
  state: JourneyState;
  locale: string;
}) {
  const className =
    state === "done"
      ? "border-emerald-500/25 bg-emerald-500/10"
      : state === "current"
        ? "border-violet-500/30 bg-violet-500/10"
        : state === "stopped"
          ? "border-rose-500/20 bg-rose-500/10"
          : "border-border bg-background";
  const numberClassName =
    state === "done"
      ? "bg-emerald-600 text-white"
      : state === "current"
        ? "bg-violet-600 text-white"
        : state === "stopped"
          ? "bg-rose-500/15 text-rose-600"
          : "bg-muted text-muted-foreground";
  const stateKey: KlyxBookingDetailMessageKey =
    state === "done"
      ? "journeyDone"
      : state === "current"
        ? "journeyCurrent"
        : state === "stopped"
          ? "journeyStopped"
          : "journeyUpcoming";

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${numberClassName}`}
        >
          {state === "done" ? <Check size={15} /> : number}
        </span>
        <div>
          <p className="font-black">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {translateKlyxBookingDetail(locale, stateKey)}
          </p>
        </div>
      </div>
    </div>
  );
}
