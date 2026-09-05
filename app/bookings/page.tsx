// KLYX_BOOKINGS_UI_CURRENCY_PHASE_5G
"use client";

import {
  SplitMissionCardView,
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
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { translateKlyxActivityDelete } from "@/lib/klyx-activity-delete-i18n";
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
// KLYX_ACTIVITY_RECENT_DELETE_2026_09_05

const SESSION_MISSING = "KLYX_BOOKINGS_SESSION_MISSING";

type BookingFilter = "actions" | "upcoming" | "history" | "all";
type HiddenEntityType = "booking" | "group" | "split";

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

type HiddenResponse = {
  ok?: boolean;
  hidden?: Array<{
    entityType: HiddenEntityType;
    entityId: string;
    hiddenAt: string;
  }>;
};

type ActivityItem =
  | {
      kind: "booking";
      key: string;
      createdAt: string;
      booking: BookingCard;
    }
  | {
      kind: "split";
      key: string;
      createdAt: string;
      mission: SplitMissionSummary;
    };

async function accessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error(SESSION_MISSING);
  return session.access_token;
}

function hiddenKey(entityType: HiddenEntityType, entityId: string) {
  return `${entityType}:${entityId}`;
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
    return "border-primary/20 bg-accent/40 text-primary";
  }

  return "border-border bg-background text-muted-foreground";
}

function bookingMatchesFilter(booking: BookingCard, filter: BookingFilter) {
  if (filter === "actions") return booking.actionRequired;
  if (filter === "upcoming") return !booking.history;
  if (filter === "history") return booking.history;
  return true;
}

export default function BookingsPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxBookingsPageMessageKey) =>
    translateKlyxBookingsPage(locale, key);

  const [accountType, setAccountType] = useState<"client" | "provider">("client");
  const [bookings, setBookings] = useState<BookingCard[]>([]);
  const [splitMissions, setSplitMissions] = useState<SplitMissionSummary[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] =
    useState<KlyxBookingsPageMessageKey | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [hiddenChildren, setHiddenChildren] = useState(0);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    setDeleteError(null);

    try {
      const token = await accessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [response, hiddenResponse] = await Promise.all([
        fetch("/api/bookings/overview", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/bookings/activity-hidden", {
          cache: "no-store",
          headers,
        }),
      ]);

      if (response.status === 401 || hiddenResponse.status === 401) {
        router.replace("/login");
        return;
      }

      const body = (await response.json()) as OverviewResponse;
      const hiddenBody = (await hiddenResponse.json()) as HiddenResponse;

      // Fail closed: a malformed overview must never be rendered as an empty success state.
      if (
        !response.ok ||
        !Array.isArray(body.cards) ||
        !hiddenResponse.ok ||
        hiddenBody.ok !== true ||
        !Array.isArray(hiddenBody.hidden)
      ) {
        setErrorKey("loadFailed");
        return;
      }

      const nextAccountType = body.accountType ?? "client";
      setAccountType(nextAccountType);

      if (nextAccountType === "provider") {
        router.replace("/provider/jobs");
        return;
      }

      const removed = new Set(
        hiddenBody.hidden.map((item) => hiddenKey(item.entityType, item.entityId))
      );
      const nextBookings = body.cards
        .filter(
          (card) => !removed.has(hiddenKey(card.entityType, card.id))
        )
        .sort((first, second) =>
          second.createdAt.localeCompare(first.createdAt)
        );

      let nextSplitMissions: SplitMissionSummary[] = [];
      let hiddenSplitBookingIds = new Set<string>();

      try {
        const splitResponse = await fetch("/api/bookings/split-missions", {
          cache: "no-store",
          headers,
        });

        if (splitResponse.ok) {
          const splitBody = (await splitResponse.json()) as {
            missions?: SplitMissionSummary[];
            childBookingIds?: string[];
          };

          nextSplitMissions = Array.isArray(splitBody.missions)
            ? splitBody.missions
                .filter(
                  (mission) => !removed.has(hiddenKey("split", mission.id))
                )
                .sort((first, second) =>
                  second.createdAt.localeCompare(first.createdAt)
                )
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
        nextBookings.filter((card) => !hiddenSplitBookingIds.has(card.id))
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

  const removeMission = useCallback(
    async (entityType: HiddenEntityType, entityId: string) => {
      if (!window.confirm(translateKlyxActivityDelete(locale, "confirm"))) {
        return;
      }

      const key = hiddenKey(entityType, entityId);
      setDeletingKey(key);
      setDeleteError(null);

      try {
        const token = await accessToken();
        const response = await fetch("/api/bookings/activity-hidden", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entityType, entityId }),
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | { ok?: boolean }
          | null;

        if (!response.ok || body?.ok !== true) {
          setDeleteError(translateKlyxActivityDelete(locale, "failed"));
          return;
        }

        if (entityType === "split") {
          setSplitMissions((current) =>
            current.filter((mission) => mission.id !== entityId)
          );
        } else {
          setBookings((current) =>
            current.filter(
              (booking) =>
                !(
                  booking.id === entityId &&
                  booking.entityType === entityType
                )
            )
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message === SESSION_MISSING) {
          router.replace("/login");
          return;
        }

        setDeleteError(translateKlyxActivityDelete(locale, "failed"));
      } finally {
        setDeletingKey(null);
      }
    },
    [locale, router]
  );

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

  const visibleItems = useMemo<ActivityItem[]>(() => {
    const bookingItems: ActivityItem[] = bookings
      .filter((booking) => bookingMatchesFilter(booking, filter))
      .map((booking) => ({
        kind: "booking",
        key: hiddenKey(booking.entityType, booking.id),
        createdAt: booking.createdAt,
        booking,
      }));
    const splitItems: ActivityItem[] = splitMissions
      .filter((mission) => splitMissionMatchesFilter(mission, filter))
      .map((mission) => ({
        kind: "split",
        key: hiddenKey("split", mission.id),
        createdAt: mission.createdAt,
        mission,
      }));

    return [...bookingItems, ...splitItems].sort((first, second) =>
      second.createdAt.localeCompare(first.createdAt)
    );
  }, [bookings, filter, splitMissions]);

  const filterOptions: Array<{ value: BookingFilter; label: string }> = [
    { value: "all", label: t("filterAll") },
    { value: "actions", label: t("filterActions") },
    { value: "upcoming", label: t("filterUpcoming") },
    { value: "history", label: t("filterHistory") },
  ];

  if (accountType === "provider") {
    return (
      <main className="grid min-h-[40vh] place-items-center bg-background">
        <LoaderCircle className="animate-spin text-primary" size={28} />
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="klyx-eyebrow uppercase">{t("clientTracking")}</p>
            <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("clientDescription")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadBookings()}
            disabled={loading}
            aria-label={t("refresh")}
            title={t("refresh")}
            className="mt-1 inline-grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {hiddenChildren > 0 && (
          <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Layers3 size={14} className="text-primary" />
            {t("groupedViewActive")}
          </p>
        )}

        {(errorKey || deleteError) && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-sm text-foreground">
            {deleteError ?? (errorKey ? t(errorKey) : null)}
          </div>
        )}

        {loading ? (
          <div className="mt-6 flex min-h-24 items-center justify-center rounded-2xl border border-border bg-card px-4">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              <LoaderCircle size={19} className="animate-spin text-primary" />
              {t("loading")}
            </div>
          </div>
        ) : errorKey ? null : counts.all === 0 ? (
          <EmptyState />
        ) : (
          <>
            <nav
              aria-label={t("title")}
              className="mt-6 flex gap-4 overflow-x-auto border-b border-border sm:gap-6"
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
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}{" "}
                    <span className="text-xs">· {counts[option.value]}</span>
                  </button>
                );
              })}
            </nav>

            {visibleItems.length === 0 ? (
              <div className="mt-6 border-b border-border pb-6 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t("nothingToHandle")}</p>
                <p className="mt-1.5">{t("nothingToHandleDescription")}</p>
              </div>
            ) : (
              <section
                className="klyx-activity-list mt-6 overflow-hidden rounded-[1.25rem] border border-border bg-card"
                aria-label={t("title")}
                data-order="created-at-desc"
              >
                {visibleItems.map((item, index) =>
                  item.kind === "booking" ? (
                    <BookingCardView
                      key={item.key}
                      booking={item.booking}
                      divided={index > 0}
                      deleting={deletingKey === item.key}
                      onDelete={(booking) =>
                        removeMission(booking.entityType, booking.id)
                      }
                    />
                  ) : (
                    <SplitMissionCardView
                      key={item.key}
                      mission={item.mission}
                      divided={index > 0}
                      deleting={deletingKey === item.key}
                      onDelete={(mission) =>
                        removeMission("split", mission.id)
                      }
                    />
                  )
                )}
              </section>
            )}

            <div className="mt-6">
              <Link
                href="/assistant"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary transition hover:opacity-75"
              >
                {t("organizeAnotherNeed")}
                <ArrowRight size={16} />
              </Link>
            </div>
          </>
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
    <div className="mt-8 max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8">
      <CalendarDays className="text-primary" size={30} />
      <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("emptyClient")}
      </p>
      <Link
        href="/assistant"
        className="klyx-button mt-5 inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold"
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
  deleting,
  onDelete,
}: {
  booking: BookingCard;
  divided: boolean;
  deleting: boolean;
  onDelete: (booking: BookingCard) => void | Promise<void>;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxBookingsPageMessageKey) =>
    translateKlyxBookingsPage(locale, key);
  const grouped = booking.entityType === "group";

  return (
    <article
      className={`p-4 sm:p-5 ${divided ? "border-t border-border" : ""}`}
      data-created-at={booking.createdAt}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                booking.status
              )}`}
            >
              {formatKlyxBookingStatus(locale, booking.status)}
            </span>

            {booking.actionRequired && (
              <span className="text-xs font-semibold text-primary">
                {t("actionRequiredNotice")}
              </span>
            )}

            {grouped && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers3 size={13} className="text-primary" />
                {t("groupedMission")}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
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

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            href={booking.href}
            className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-semibold text-primary transition hover:opacity-75"
          >
            {grouped ? t("openGroupedMission") : t("viewBooking")}
            <ArrowRight size={16} />
          </Link>

          <button
            type="button"
            onClick={() => void onDelete(booking)}
            disabled={deleting}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground transition hover:border-red-500/30 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            {translateKlyxActivityDelete(
              locale,
              deleting ? "deleting" : "delete"
            )}
          </button>
        </div>
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
