"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile, type SavedAccount } from "@/lib/account-switcher";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  service_status: string | null;
  amount_total: number | null;
  estimated_amount_cents: number | null;
  currency: string | null;
  created_at: string;
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

type BookingCard = BookingRow & {
  otherUserName: string;
  otherUserAvatar: string | null;
  serviceLabel: string;
  role: "client" | "provider";
};

type BookingFilter = "actions" | "upcoming" | "history" | "all";

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Ménage",
  moving: "Déménagement",
  handyman: "Bricolage",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  rejected: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  accepted: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  cancelled: "border-zinc-700 bg-zinc-800 text-zinc-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

function formatName(profile: ProfileRow | undefined): string {
  if (!profile) return "Utilisateur KLYX";

  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Utilisateur KLYX"
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatAmount(booking: BookingCard): string {
  const amount = booking.estimated_amount_cents ?? booking.amount_total;

  if (amount == null) return "Prix à confirmer";

  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: booking.currency || "EUR",
  }).format(amount / 100);
}

function needsAction(booking: BookingCard): boolean {
  if (booking.role === "provider") return booking.status === "pending";

  return (
    booking.status === "accepted" &&
    booking.payment_status !== "paid"
  );
}

function isHistory(booking: BookingCard): boolean {
  return ["rejected", "cancelled", "completed"].includes(booking.status);
}

export default function BookingsPage() {
  const router = useRouter();
  const [activeProfile, setActiveProfile] = useState<SavedAccount | null>(null);
  const [bookings, setBookings] = useState<BookingCard[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("actions");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const profile = await getActiveClientProfile();
      setActiveProfile(profile);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          "id, parent_id, provider_id, babysitter_id, service_id, booking_date, start_time, end_time, status, payment_status, service_status, amount_total, estimated_amount_cents, currency, created_at"
        )
        .or(
          `parent_id.eq.${profile.id},provider_id.eq.${profile.id},babysitter_id.eq.${profile.id}`
        )
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (bookingError) throw new Error(bookingError.message);

      const bookingRows = (bookingData ?? []) as BookingRow[];

      if (bookingRows.length === 0) {
        setBookings([]);
        return;
      }

      const profileIds = Array.from(
        new Set(
          bookingRows.flatMap((booking) =>
            [booking.parent_id, booking.provider_id ?? booking.babysitter_id].filter(
              (value): value is string => Boolean(value)
            )
          )
        )
      );
      const serviceIds = Array.from(
        new Set(
          bookingRows
            .map((booking) => booking.service_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      const [profilesResult, servicesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", profileIds),
        serviceIds.length > 0
          ? supabase.from("services").select("id, slug").in("id", serviceIds)
          : Promise.resolve({ data: [] as ServiceRow[], error: null }),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (servicesResult.error) throw new Error(servicesResult.error.message);

      const profileById = new Map(
        ((profilesResult.data ?? []) as ProfileRow[]).map((item) => [item.id, item])
      );
      const serviceById = new Map(
        ((servicesResult.data ?? []) as ServiceRow[]).map((item) => [item.id, item])
      );

      setBookings(
        bookingRows.map((booking): BookingCard => {
          const providerId = booking.provider_id ?? booking.babysitter_id ?? "";
          const role = booking.parent_id === profile.id ? "client" : "provider";
          const otherUserId = role === "client" ? providerId : booking.parent_id;
          const otherProfile = profileById.get(otherUserId);
          const serviceSlug = booking.service_id
            ? serviceById.get(booking.service_id)?.slug
            : "babysitting";

          return {
            ...booking,
            role,
            otherUserName: formatName(otherProfile),
            otherUserAvatar: otherProfile?.avatar_url ?? null,
            serviceLabel:
              SERVICE_LABELS[serviceSlug ?? ""] ?? serviceSlug ?? "Service KLYX",
          };
        })
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les réservations."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBookings();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  const counts = useMemo(
    () => ({
      actions: bookings.filter(needsAction).length,
      upcoming: bookings.filter((booking) => !isHistory(booking)).length,
      history: bookings.filter(isHistory).length,
      all: bookings.length,
    }),
    [bookings]
  );

  const visibleBookings = useMemo(() => {
    if (filter === "actions") return bookings.filter(needsAction);
    if (filter === "upcoming") return bookings.filter((booking) => !isHistory(booking));
    if (filter === "history") return bookings.filter(isHistory);

    return bookings;
  }, [bookings, filter]);

  const filterOptions: Array<{ value: BookingFilter; label: string }> = [
    { value: "actions", label: "À traiter" },
    { value: "upcoming", label: "À venir" },
    { value: "history", label: "Historique" },
    { value: "all", label: "Toutes" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
              Retour au tableau de bord
            </Link>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
              {activeProfile?.accountType === "provider"
                ? "Espace prestataire"
                : "Espace client"}
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-5xl">Mes réservations</h1>
            <p className="mt-3 text-zinc-400">
              Demandes, confirmations, rendez-vous et historique au même endroit.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadBookings()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-900 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  filter === option.value
                    ? "border-violet-500 bg-violet-600 text-white"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {option.label} · {counts[option.value]}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            Chargement des réservations...
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState accountType={activeProfile?.accountType ?? "client"} />
        ) : visibleBookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <CheckCircle2 className="mx-auto text-emerald-400" size={40} />
            <h2 className="mt-4 text-xl font-bold">Rien à traiter</h2>
            <p className="mt-2 text-zinc-400">
              Toutes les demandes sont à jour. Consulte « À venir » ou l’historique.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {visibleBookings.map((booking) => (
              <BookingCardView key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ accountType }: { accountType: "client" | "provider" }) {
  return (
    <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
      <Search className="mx-auto text-violet-400" size={44} />
      <h2 className="mt-5 text-2xl font-bold">Aucune réservation pour le moment</h2>
      <p className="mx-auto mt-3 max-w-lg text-zinc-400">
        {accountType === "provider"
          ? "Les nouvelles demandes apparaîtront ici dès qu’un client réservera l’un de tes services."
          : "Trouve un prestataire publié et envoie ta première demande."}
      </p>
      <Link
        href={accountType === "provider" ? "/provider" : "/search"}
        className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"
      >
        {accountType === "provider" ? "Gérer ma fiche" : "Trouver un service"}
      </Link>
    </div>
  );
}

function BookingCardView({ booking }: { booking: BookingCard }) {
  const actionRequired = needsAction(booking);

  return (
    <article
      className={`rounded-3xl border bg-zinc-900 p-6 transition hover:-translate-y-0.5 ${
        actionRequired ? "border-violet-500/50" : "border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
            {booking.otherUserAvatar ? (
              <img
                src={booking.otherUserAvatar}
                alt={booking.otherUserName}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="text-zinc-500" size={24} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{booking.otherUserName}</p>
            <p className="text-sm text-violet-400">{booking.serviceLabel}</p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
            STATUS_STYLES[booking.status] ?? STATUS_STYLES.cancelled
          }`}
        >
          {STATUS_LABELS[booking.status] ?? booking.status}
        </span>
      </div>

      {actionRequired && (
        <p className="mt-5 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm font-semibold text-violet-200">
          {booking.role === "provider"
            ? "Cette demande attend ta réponse."
            : "La demande est acceptée : tu peux payer la réservation."}
        </p>
      )}

      <div className="mt-5 grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <CalendarDays size={17} />
          {formatDate(booking.booking_date)}
        </p>
        <p className="flex items-center gap-2">
          <Clock3 size={17} />
          {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-5">
        <div>
          <p className="text-xs text-zinc-500">Total estimé</p>
          <p className="mt-1 text-xl font-bold">{formatAmount(booking)}</p>
        </div>
        <Link
          href={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-700"
        >
          {actionRequired ? "Traiter" : "Détails"}
          <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}
