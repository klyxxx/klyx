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
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_GROUPED_BOOKINGS_PAGE_12_92

type BookingFilter =
  | "actions"
  | "upcoming"
  | "history"
  | "all";

type BookingCard = {
  id: string;

  entityType:
    | "booking"
    | "group";

  href: string;

  role:
    | "client"
    | "provider";

  otherUserName:
    string;

  otherUserAvatar:
    | string
    | null;

  serviceLabel:
    string;

  status:
    string;

  statusLabel:
    string;

  paymentStatus:
    string;

  amountCents:
    | number
    | null;

  currency:
    string;

  dateFrom:
    string;

  dateTo:
    string;

  firstStart:
    string;

  lastEnd:
    string;

  slotCount:
    number;

  actionRequired:
    boolean;

  history:
    boolean;

  cancellationPending:
    boolean;

  refundStatus:
    string;

  createdAt:
    string;
};

type OverviewResponse = {
  accountType?:
    | "client"
    | "provider";

  cards?:
    BookingCard[];

  count?: number;

  groupCount?: number;

  childBookingsHidden?:
    number;

  groupedDisplay?:
    boolean;

  error?: string;
};

const STATUS_STYLES:
  Record<
    string,
    string
  > = {
    pending:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",

    payment_pending:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",

    accepted:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",

    completed:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",

    cancelled:
      "border-border bg-muted text-muted-foreground",

    rejected:
      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",

    cancellation_waiting:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",

    cancellation_decision:
      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",

    refund_processing:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",

    refund_failed:
      "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",

    refunded:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };

async function accessToken() {
  const {
    data: {
      session,
    },
  } =
    await supabase.auth.getSession();

  if (
    !session?.access_token
  ) {
    throw new Error(
      "Session manquante."
    );
  }

  return session.access_token;
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "fr-BE",
    {
      weekday:
        "short",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    new Date(
      value +
      "T12:00:00"
    )
  );
}

function dateLabel(
  card: BookingCard
) {
  if (
    card.dateFrom ===
    card.dateTo
  ) {
    return formatDate(
      card.dateFrom
    );
  }

  return (
    formatDate(
      card.dateFrom
    ) +
    " → " +
    formatDate(
      card.dateTo
    )
  );
}

function timeLabel(
  card: BookingCard
) {
  if (
    card.entityType ===
      "group"
  ) {
    return (
      String(
        card.slotCount
      ) +
      " creneau" +
      (
        card.slotCount >
        1
          ? "x"
          : ""
      )
    );
  }

  return (
    card.firstStart.slice(
      0,
      5
    ) +
    " - " +
    card.lastEnd.slice(
      0,
      5
    )
  );
}

function amountLabel(
  card: BookingCard
) {
  if (
    card.amountCents ==
    null
  ) {
    return "Prix a confirmer";
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency:
        card.currency ||
        "EUR",
    }
  ).format(
    card.amountCents /
    100
  );
}

export default function BookingsPage() {
  const router =
    useRouter();

  const [
    accountType,
    setAccountType,
  ] =
    useState<
      | "client"
      | "provider"
    >(
      "client"
    );

  const [
    bookings,
    setBookings,
  ] =
    useState<
      BookingCard[]
    >([]);
  // KLYX_SPLIT_MISSION_CONSOLIDATION_13_21
  const [
    splitMissions,
    setSplitMissions,
  ] =
    useState<
      SplitMissionSummary[]
    >([]);

  const [
    filter,
    setFilter,
  ] =
    useState<BookingFilter>(
      "actions"
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    hiddenChildren,
    setHiddenChildren,
  ] =
    useState(0);

  const loadBookings =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setErrorMessage(
          ""
        );

        try {
          const token =
            await accessToken();

          const response =
            await fetch(
              "/api/bookings/overview",
              {
                cache:
                  "no-store",

                headers: {
                  Authorization:
                    "Bearer " +
                    token,
                },
              }
            );

          const body =
            (await response.json()) as
              OverviewResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
              "Chargement impossible."
            );
          }

          setAccountType(
            body.accountType ??
            "client"
          );


          // KLYX_SPLIT_MISSION_CHILD_FILTER_13_21D
          const overviewCards =
            body.cards ??
            [];

          let nextSplitMissions:
            SplitMissionSummary[] =
            [];

          let hiddenSplitBookingIds =
            new Set<string>();

          if (
            (
              body.accountType ??
              "client"
            ) ===
            "client"
          ) {
            try {
              const splitResponse =
                await fetch(
                  "/api/bookings/split-missions",
                  {
                    cache:
                      "no-store",

                    headers: {
                      Authorization:
                        "Bearer " +
                        token,
                    },
                  }
                );

              if (
                splitResponse.ok
              ) {
                const splitBody =
                  (
                    await splitResponse.json()
                  ) as {
                    missions?:
                      SplitMissionSummary[];

                    childBookingIds?:
                      string[];
                  };

                nextSplitMissions =
                  Array.isArray(
                    splitBody.missions
                  )
                    ? splitBody.missions
                    : [];

                hiddenSplitBookingIds =
                  new Set(
                    Array.isArray(
                      splitBody.childBookingIds
                    )
                      ? splitBody.childBookingIds
                      : []
                  );
              }
            } catch {
              nextSplitMissions =
                [];

              hiddenSplitBookingIds =
                new Set<string>();
            }
          }

          setSplitMissions(
            nextSplitMissions
          );

          setBookings(
            overviewCards.filter(
              (
                card
              ) =>
                !hiddenSplitBookingIds.has(
                  card.id
                )
            )
          );

          setHiddenChildren(
            (body.childBookingsHidden ?? 0) +
            hiddenSplitBookingIds.size
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message ===
              "Session manquante."
          ) {
            router.replace(
              "/login"
            );

            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger les reservations."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        router,
      ]
    );

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const counts =
    useMemo(
      () => ({
        actions:
          bookings.filter(
            (booking) =>
              booking.actionRequired
          ).length,

        upcoming:
          bookings.filter(
            (booking) =>
              !booking.history
          ).length,

        history:
          bookings.filter(
            (booking) =>
              booking.history
          ).length,

        all:
          bookings.length,
      }),
      [
        bookings,
      ]
    );


  // KLYX_SPLIT_MISSION_COUNTS_13_21D
  const splitMissionCounts =
    useMemo(
      () => ({
        actions:
          splitMissions.filter(
            splitMissionNeedsAction
          ).length,

        upcoming:
          splitMissions.filter(
            (
              mission
            ) =>
              !splitMissionIsHistory(
                mission
              )
          ).length,

        history:
          splitMissions.filter(
            splitMissionIsHistory
          ).length,

        all:
          splitMissions.length,
      }),
      [
        splitMissions,
      ]
    );
  const visibleBookings =
    useMemo(
      () => {
        if (
          filter ===
          "actions"
        ) {
          return bookings.filter(
            (booking) =>
              booking.actionRequired
          );
        }

        if (
          filter ===
          "upcoming"
        ) {
          return bookings.filter(
            (booking) =>
              !booking.history
          );
        }

        if (
          filter ===
          "history"
        ) {
          return bookings.filter(
            (booking) =>
              booking.history
          );
        }

        return bookings;
      },
      [
        bookings,
        filter,
      ]
    );

  const filterOptions:
    Array<{
      value:
        BookingFilter;

      label:
        string;
    }> = [
      {
        value:
          "actions",

        label:
          "A traiter",
      },

      {
        value:
          "upcoming",

        label:
          "A venir",
      },

      {
        value:
          "history",

        label:
          "Historique",
      },

      {
        value:
          "all",

        label:
          "Toutes",
      },
    ];

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              Retour au tableau de bord
            </Link>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              {accountType ===
              "provider"
                ? "Espace prestataire"
                : "Espace client"}
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              Mes reservations
            </h1>

            <p className="mt-3 max-w-2xl text-muted-foreground">
              Une mission multi-creneaux apparait maintenant comme
              une seule reservation KLYX.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadBookings()
            }
            disabled={
              loading
            }
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-black transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Actualiser
          </button>
        </div>

        {hiddenChildren >
          0 && (
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-xs font-black text-violet-700 dark:text-violet-300">
            <Layers3
              size={15}
            />

            Vue groupee active
          </div>
        )}

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading &&
          bookings.length >
          0 && (
          <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
            {filterOptions.map(
              (
                option
              ) => (
                <button
                  key={
                    option.value
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      option.value
                    )
                  }
                  className={
                    "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-black transition " +
                    (
                      filter ===
                      option.value
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  {
                    option.label
                  }
                  {" · "}
                  {
                    counts[
                      option.value
                    ]
                  }
                </button>
              )
            )}
          </div>
        )}

        {/* KLYX_SPLIT_MISSION_LIST_WIRING_13_21 */}
        {!loading && (
          <SplitMissionSection
            missions={
              splitMissions
            }
            filter={
              filter
            }
          />
        )}
        {loading ? (
          <div className="mt-10 flex min-h-48 items-center justify-center rounded-3xl border border-border bg-card">
            <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
              <LoaderCircle
                size={20}
                className="animate-spin"
              />

              Chargement des reservations...
            </div>
          </div>
        ) : bookings.length === 0 && splitMissions.length === 0 ? (
          <EmptyState
            accountType={
              accountType
            }
          />
        ) : visibleBookings.length === 0 && splitMissions.filter((mission) => splitMissionMatchesFilter(mission, filter)).length === 0 ? (
          <div className="mt-8 rounded-3xl border border-border bg-card p-10 text-center">
            <CheckCircle2
              className="mx-auto text-emerald-500"
              size={42}
            />

            <h2 className="mt-4 text-xl font-black">
              Rien a traiter
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Les missions qui demandent ton intervention apparaitront ici.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {visibleBookings.map(
              (
                booking
              ) => (
                <BookingCardView
                  key={
                    booking.entityType +
                    ":" +
                    booking.id
                  }
                  booking={
                    booking
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({
  accountType,
}: {
  accountType:
    | "client"
    | "provider";
}) {
  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-10 text-center">
      <Search
        className="mx-auto text-violet-500"
        size={44}
      />

      <h2 className="mt-5 text-2xl font-black">
        Aucune reservation pour le moment
      </h2>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
        {accountType ===
        "provider"
          ? "Les nouvelles missions apparaitront ici lorsqu un client choisira tes services."
          : "Trouve un prestataire et organise ta premiere mission avec KLYX."}
      </p>

      <Link
        href={
          accountType ===
          "provider"
            ? "/provider"
            : "/search"
        }
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-700"
      >
        {accountType ===
        "provider"
          ? "Gerer ma fiche"
          : "Trouver un service"}
      </Link>
    </div>
  );
}

function BookingCardView({
  booking,
}: {
  booking:
    BookingCard;
}) {
  const grouped =
    booking.entityType ===
    "group";

  return (
    <article
      className={
        "rounded-3xl border bg-card p-6 transition hover:-translate-y-0.5 " +
        (
          booking.actionRequired
            ? "border-violet-500/50 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
            : "border-border"
        )
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
            {booking.otherUserAvatar ? (
              <img
                src={
                  booking.otherUserAvatar
                }
                alt={
                  booking.otherUserName
                }
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound
                className="text-muted-foreground"
                size={24}
              />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-black">
              {
                booking.otherUserName
              }
            </p>

            <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
              {
                booking.serviceLabel
              }
            </p>
          </div>
        </div>

        <span
          className={
            "shrink-0 rounded-full border px-3 py-1 text-xs font-black " +
            (
              STATUS_STYLES[
                booking.status
              ] ??
              "border-border bg-muted text-muted-foreground"
            )
          }
        >
          {
            booking.statusLabel
          }
        </span>
      </div>

      {grouped && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm">
          <Layers3
            className="shrink-0 text-violet-600"
            size={18}
          />

          <div>
            <p className="font-black">
              Mission groupee
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {
                booking.slotCount
              }
              {" creneaux reunis dans une seule reservation"}
            </p>
          </div>
        </div>
      )}

      {booking.actionRequired && (
        <div className="mt-5 flex gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/10 p-3 text-sm font-bold text-violet-700 dark:text-violet-300">
          <ShieldCheck
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>
            Une action de ta part est requise.
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Info
          icon={
            <CalendarDays
              size={17}
            />
          }
          label="Date"
          value={
            dateLabel(
              booking
            )
          }
        />

        <Info
          icon={
            <Clock3
              size={17}
            />
          }
          label={
            grouped
              ? "Planning"
              : "Horaire"
          }
          value={
            timeLabel(
              booking
            )
          }
        />
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            <CreditCard
              size={16}
            />

            {grouped
              ? "Total mission"
              : "Montant"}
          </div>

          <p className="text-lg font-black">
            {
              amountLabel(
                booking
              )
            }
          </p>
        </div>
      </div>

      <Link
        href={
          booking.href
        }
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-700"
      >
        {grouped
          ? "Ouvrir la mission groupee"
          : "Voir la reservation"}

        <ArrowRight
          size={17}
        />
      </Link>
    </article>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;

  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-2 text-sm font-black">
        {value}
      </p>
    </div>
  );
}