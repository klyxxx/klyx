// KLYX_BOOKINGS_UI_CURRENCY_PHASE_5G
"use client";

import SplitMissionSection, {
  splitMissionIsHistory,
  splitMissionMatchesFilter,
  splitMissionNeedsAction,
  type SplitMissionSummary,
} from "./SplitMissionSection";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  Layers3,
  LoaderCircle,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxBookingAmount,
  formatKlyxBookingDateRange,
  formatKlyxBookingSlotCount,
  formatKlyxBookingStatus,
  translateKlyxBookingsPage,
  type KlyxBookingsPageMessageKey,
} from "@/lib/klyx-bookings-page-i18n";
import { formatKlyxBookingServiceFromSlug } from "@/lib/klyx-bookings-service-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_GROUPED_BOOKINGS_PAGE_12_92
// KLYX_BOOKINGS_PAGE_I18N_16_09
// KLYX_ACTIVITY_DESTINATION_2026_09_01

const SESSION_MISSING = "KLYX_BOOKINGS_SESSION_MISSING";

type BookingFilter = "actions" | "upcoming" | "history" | "all";

type BookingCard = {
  id: string;
  entityType: "booking" | "group";
  href: string;
  role: "client" | "provider";
  otherUserName: string;
  otherUserAvatar: string | null;
  serviceLabel: string;
  serviceSlug: string | null;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  amountCents: number | null;
  currency: string;
  dateFrom: string;
  dateTo: string;
  firstStart: string;
  lastEnd: string;
  slotCount: number;
  actionRequired: boolean;
  history: boolean;
  cancellationPending: boolean;
  refundStatus: string;
  createdAt: string;
};

type OverviewResponse = {
  accountType?: "client" | "provider";
  cards?: BookingCard[];
  count?: number;
  groupCount?: number;
  childBookingsHidden?: number;
  groupedDisplay?: boolean;
};

async function accessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error(SESSION_MISSING);
  return session.access_token;
}

function dateLabel(locale: string, card: BookingCard) {
  return formatKlyxBookingDateRange(locale, card.dateFrom, card.dateTo);
}

function timeLabel(locale: string, card: BookingCard) {
  if (card.entityType === "group") {
    return formatKlyxBookingSlotCount(locale, card.slotCount);
  }

  return `${card.firstStart.slice(0, 5)} - ${card.lastEnd.slice(0, 5)}`;
}

function amountLabel(locale: string, card: BookingCard) {
  return formatKlyxBookingAmount(locale, card.amountCents, card.currency);
}

function serviceLabel(locale: string, card: BookingCard) {
  return formatKlyxBookingServiceFromSlug(
    locale,
    card.serviceSlug,
    card.serviceLabel
  );
}

function statusClass(status: string) {
  if (
    status === "pending" ||
    status === "payment_pending" ||
    status === "accepted" ||
    status === "cancellation_waiting" ||
    status === "cancellation_decision" ||
    status === "refund_processing" ||
    status === "refunded"
  ) {
    return "border-blue-600/20 bg-blue-600/[0.06] text-blue-700 dark:text-blue-300";
  }

  return "border-border bg-background text-muted-foreground";
}

export default function BookingsPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxBookingsPageMessageKey) =>
    translateKlyxBookingsPage(locale, key);

  const [accountType, setAccountType] = useState<"client" | "provider">("client");
  const [bookings, setBookings] = useState<BookingCard[]>([]);
  const [splitMissions, setSplitMissions] = useState<SplitMissionSummary[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("actions");
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] =
    useState<KlyxBookingsPageMessageKey | null>(null);
  const [hiddenChildren, setHiddenChildren] = useState(0);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      const token = await accessToken();
      const response = await fetch("/api/bookings/overview", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const body = (await response.json()) as OverviewResponse;
      if (!response.ok) {
        setErrorKey("loadFailed");
        return;
      }

      const nextAccountType = body.accountType ?? "client";
      setAccountType(nextAccountType);

      if (nextAccountType === "provider") {
        router.replace("/provider/jobs");
        return;
      }

      const overviewCards = body.cards ?? [];
      let nextSplitMissions: SplitMissionSummary[] = [];
      let hiddenSplitBookingIds = new Set<string>();

      try {
        const splitResponse = await fetch("/api/bookings/split-missions", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (splitResponse.ok) {
          const splitBody = (await splitResponse.json()) as {
            missions?: SplitMissionSummary[];
            childBookingIds?: string[];
          };

          nextSplitMissions = Array.isArray(splitBody.missions)
            ? splitBody.missions
            : [];
          hiddenSplitBookingIds = new Set(
            Array.isArray(splitBody.childBookingIds)
              ? splitBody.childBookingIds
              : []
          );
        }
      } catch {
        nextSplitMissions = [];
        hiddenSplitBookingIds = new Set<string>();
      }

      setSplitMissions(nextSplitMissions);
      setBookings(
        overviewCards.filter((card) => !hiddenSplitBookingIds.has(card.id))
      );
      setHiddenChildren(
        (body.childBookingsHidden ?? 0) + hiddenSplitBookingIds.size
      );
    } catch (error) {
      if (error instanceof Error && error.message === SESSION_MISSING) {
        router.replace("/login");
        return;
      }

      setErrorKey("loadFailed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const counts = useMemo(() => {
    const bookingCounts = {
      actions: bookings.filter((booking) => booking.actionRequired).length,
      upcoming: bookings.filter((booking) => !booking.history).length,
      history: bookings.filter((booking) => booking.history).length,
      all: bookings.length,
    };

    const splitCounts = {
      actions: splitMissions.filter(splitMissionNeedsAction).length,
      upcoming: splitMissions.filter(
        (mission) => !splitMissionIsHistory(mission)
      ).length,
      history: splitMissions.filter(splitMissionIsHistory).length,
      all: splitMissions.length,
    };

    return {
      actions: bookingCounts.actions + splitCounts.actions,
      upcoming: bookingCounts.upcoming + splitCounts.upcoming,
      history: bookingCounts.history + splitCounts.history,
      all: bookingCounts.all + splitCounts.all,
    };
  }, [bookings, splitMissions]);

  const visibleBookings = useMemo(() => {
    if (filter === "actions") {
      return bookings.filter((booking) => booking.actionRequired);
    }
    if (filter === "upcoming") {
      return bookings.filter((booking) => !booking.history);
    }
    if (filter === "history") {
      return bookings.filter((booking) => booking.history);
    }
    return bookings;
  }, [bookings, filter]);

  const nextBooking = useMemo(
    () =>
      bookings.find((booking) => booking.actionRequired) ??
      bookings.find((booking) => !booking.history) ??
      null,
    [bookings]
  );

  const remainingBookings = useMemo(
    () =>
      visibleBookings.filter(
        (booking) =>
          !nextBooking ||
          booking.id !== nextBooking.id ||
          booking.entityType !== nextBooking.entityType
      ),
    [nextBooking, visibleBookings]
  );

  const visibleSplitCount = useMemo(
    () =>
      splitMissions.filter((mission) =>
        splitMissionMatchesFilter(mission, filter)
      ).length,
    [filter, splitMissions]
  );

  const filterOptions: Array<{ value: BookingFilter; label: string }> = [
    { value: "actions", label: t("filterActions") },
    { value: "upcoming", label: t("filterUpcoming") },
    { value: "history", label: t("filterHistory") },
    { value: "all", label: t("filterAll") },
  ];

  if (accountType === "provider") {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <LoaderCircle className="animate-spin text-blue-600" size={30} />
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="klyx-eyebrow uppercase">{t("clientTracking")}</p>
            <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("clientDescription")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadBookings()}
            disabled={loading}
            aria-label={t("refresh")}
            title={t("refresh")}
            className="mt-1 inline-grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {hiddenChildren > 0 && (
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Layers3 size={14} className="text-blue-600" />
            {t("groupedViewActive")}
          </p>
        )}

        {errorKey && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            {t(errorKey)}
          </div>
        )}

        {!loading && nextBooking && (
          <section className="mt-8 rounded-[1.5rem] border border-border bg-card p-5 sm:p-6">
            <p className="klyx-eyebrow uppercase">{t("nextStepKlyx")}</p>

            <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-[-0.02em]">
                  {nextBooking.actionRequired
                    ? t("agreementRequired")
                    : t("missionTracked")}
                </h2>
                <p className="mt-2 text-sm font-medium">
                  {serviceLabel(locale, nextBooking)} · {nextBooking.otherUserName}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span>{dateLabel(locale, nextBooking)}</span>
                  <span>{timeLabel(locale, nextBooking)}</span>
                  <span>{amountLabel(locale, nextBooking)}</span>
                </div>
              </div>

              <Link
                href={nextBooking.href}
                className="klyx-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold"
              >
                {t("viewMission")}
                <ArrowRight size={16} />
              </Link>
            </div>

            <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
              {t("explicitConfirmationBoundary")}
            </p>
          </section>
        )}

        {!loading && counts.all > 0 && (
          <nav
            aria-label={t("title")}
            className="mt-8 flex gap-4 overflow-x-auto border-b border-border sm:gap-6"
          >
            {filterOptions.map((option) => {
              const active = filter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-0.5 pb-3 text-sm font-medium transition ${
                    active
                      ? "border-blue-600 text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label} <span className="text-xs">· {counts[option.value]}</span>
                </button>
              );
            })}
          </nav>
        )}

        {!loading && (
          <SplitMissionSection missions={splitMissions} filter={filter} />
        )}

        {loading ? (
          <div className="mt-10 grid min-h-56 place-items-center">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              <LoaderCircle size={20} className="animate-spin" />
              {t("loading")}
            </div>
          </div>
        ) : bookings.length === 0 && splitMissions.length === 0 ? (
          <EmptyState />
        ) : visibleBookings.length === 0 && visibleSplitCount === 0 ? (
          <div className="mt-8 border-b border-border pb-8 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("nothingToHandle")}</p>
            <p className="mt-2">{t("nothingToHandleDescription")}</p>
          </div>
        ) : remainingBookings.length > 0 ? (
          <section
            className="klyx-activity-list mt-8 overflow-hidden rounded-[1.5rem] border border-border bg-card"
            aria-label={t("title")}
          >
            {remainingBookings.map((booking, index) => (
              <BookingCardView
                key={`${booking.entityType}:${booking.id}`}
                booking={booking}
                divided={index > 0}
              />
            ))}
          </section>
        ) : null}

        {!loading && counts.all > 0 && (
          <div className="mt-8">
            <Link
              href="/assistant"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {t("organizeAnotherNeed")}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxBookingsPageMessageKey) =>
    translateKlyxBookingsPage(locale, key);

  return (
    <div className="mt-12 max-w-xl py-8">
      <CalendarDays className="text-blue-600" size={32} />
      <h2 className="mt-5 text-xl font-semibold">{t("emptyTitle")}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("emptyClient")}
      </p>
      <Link
        href="/assistant"
        className="klyx-button mt-6 inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold"
      >
        {t("organizeAnotherNeed")}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function BookingCardView({
  booking,
  divided,
}: {
  booking: BookingCard;
  divided: boolean;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxBookingsPageMessageKey) =>
    translateKlyxBookingsPage(locale, key);
  const grouped = booking.entityType === "group";

  return (
    <article className={`p-5 sm:p-6 ${divided ? "border-t border-border" : ""}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
              {booking.otherUserAvatar ? (
                <img
                  src={booking.otherUserAvatar}
                  alt={booking.otherUserName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="text-muted-foreground" size={19} />
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold">{booking.otherUserName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {serviceLabel(locale, booking)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                booking.status
              )}`}
            >
              {formatKlyxBookingStatus(locale, booking.status)}
            </span>

            {booking.actionRequired && (
              <span className="text-xs font-semibold text-blue-600">
                {t("actionRequiredNotice")}
              </span>
            )}

            {grouped && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers3 size={13} className="text-blue-600" />
                {t("groupedMission")}
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <Info
              icon={<CalendarDays size={15} />}
              label={t("date")}
              value={dateLabel(locale, booking)}
            />
            <Info
              icon={<Clock3 size={15} />}
              label={grouped ? t("planning") : t("schedule")}
              value={timeLabel(locale, booking)}
            />
            <Info
              icon={<CreditCard size={15} />}
              label={grouped ? t("totalMission") : t("amount")}
              value={amountLabel(locale, booking)}
            />
          </div>
        </div>

        <Link
          href={booking.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
        >
          {grouped ? t("openGroupedMission") : t("viewBooking")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}
