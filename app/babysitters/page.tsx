"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type UserServiceRow = {
  id: string;
  user_id: string;
};

type ServiceProfileRow = {
  user_service_id: string;
  price: number | null;
  city: string | null;
  available: boolean | null;
  klyx_score: number | null;
  completed_jobs: number | null;
  cancellation_rate: number | null;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type BabysitterCard = {
  userId: string;
  userServiceId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  price: number | null;
  city: string | null;
  klyxScore: number;
  completedJobs: number;
  cancellationRate: number;
  slots: AvailabilityRow[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Très fiable";
  if (score >= 70) return "Fiable";
  if (score >= 60) return "Correct";
  return "Nouveau profil";
}

function matchesCity(
  babysitter: BabysitterCard,
  city: string
): boolean {
  if (!city) return true;
  if (!babysitter.city) return false;

  return normalize(babysitter.city).includes(normalize(city));
}

function matchesBudget(
  babysitter: BabysitterCard,
  budget: number | null
): boolean {
  if (budget === null || !Number.isFinite(budget)) return true;
  if (babysitter.price === null) return false;

  return babysitter.price <= budget;
}

function matchesAvailability(
  babysitter: BabysitterCard,
  date: string,
  time: string
): boolean {
  if (!date && !time) return true;

  let requestedDay: number | null = null;

  if (date) {
    const parsedDate = new Date(`${date}T12:00:00`);

    if (!Number.isNaN(parsedDate.getTime())) {
      requestedDay = parsedDate.getDay();
    }
  }

  const requestedMinutes = time ? timeToMinutes(time) : null;

  if (babysitter.slots.length === 0) {
    return false;
  }

  return babysitter.slots.some((slot) => {
    if (
      requestedDay !== null &&
      Number(slot.day_of_week) !== requestedDay
    ) {
      return false;
    }

    if (requestedMinutes !== null) {
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time);

      return requestedMinutes >= start && requestedMinutes < end;
    }

    return true;
  });
}

function BabysittersContent() {
  const searchParams = useSearchParams();

  const city = searchParams.get("city")?.trim() ?? "";
  const date = searchParams.get("date")?.trim() ?? "";
  const time = searchParams.get("time")?.trim() ?? "";
  const budgetText = searchParams.get("budget")?.trim() ?? "";
  const budget = budgetText ? Number(budgetText) : null;

  const hasFilters = Boolean(city || date || time || budgetText);

  const [babysitters, setBabysitters] = useState<BabysitterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadBabysitters() {
      setLoading(true);
      setErrorMessage("");

      try {
        const { data: service, error: serviceError } = await supabase
          .from("services")
          .select("id")
          .eq("slug", "babysitting")
          .maybeSingle();

        if (serviceError) throw new Error(serviceError.message);

        if (!service) {
          setBabysitters([]);
          return;
        }

        const { data: userServicesData, error: userServicesError } =
          await supabase
            .from("user_services")
            .select("id, user_id")
            .eq("service_id", service.id)
            .eq("active", true);

        if (userServicesError) {
          throw new Error(userServicesError.message);
        }

        const userServices = (userServicesData ?? []) as UserServiceRow[];

        if (userServices.length === 0) {
          setBabysitters([]);
          return;
        }

        const userServiceIds = userServices.map((item) => item.id);
        const userIds = userServices.map((item) => item.user_id);

        const [
          { data: serviceProfilesData, error: serviceProfilesError },
          { data: profilesData, error: profilesError },
          { data: availabilityData, error: availabilityError },
        ] = await Promise.all([
          supabase
            .from("service_profiles")
            .select(
              "user_service_id, price, city, available, klyx_score, completed_jobs, cancellation_rate"
            )
            .in("user_service_id", userServiceIds)
            .eq("available", true),

          supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url")
            .in("id", userIds),

          supabase
            .from("availability_slots")
            .select(
              "user_service_id, day_of_week, start_time, end_time, is_active"
            )
            .in("user_service_id", userServiceIds)
            .eq("is_active", true),
        ]);

        if (serviceProfilesError) {
          throw new Error(serviceProfilesError.message);
        }

        if (profilesError) {
          throw new Error(profilesError.message);
        }

        if (availabilityError) {
          throw new Error(availabilityError.message);
        }

        const serviceProfiles =
          (serviceProfilesData ?? []) as ServiceProfileRow[];
        const profiles = (profilesData ?? []) as ProfileRow[];
        const availability =
          (availabilityData ?? []) as AvailabilityRow[];

        const profileById = new Map(
          profiles.map((profile) => [profile.id, profile])
        );

        const userServiceById = new Map(
          userServices.map((item) => [item.id, item])
        );

        const slotsByUserService = new Map<string, AvailabilityRow[]>();

        for (const slot of availability) {
          const current =
            slotsByUserService.get(slot.user_service_id) ?? [];

          current.push(slot);
          slotsByUserService.set(slot.user_service_id, current);
        }

        const cards = serviceProfiles
          .map((serviceProfile): BabysitterCard | null => {
            const userService = userServiceById.get(
              serviceProfile.user_service_id
            );

            if (!userService) return null;

            const profile = profileById.get(userService.user_id);

            if (!profile) return null;

            return {
              userId: profile.id,
              userServiceId: userService.id,
              firstName: profile.first_name ?? "",
              lastName: profile.last_name ?? "",
              avatarUrl: profile.avatar_url,
              price: serviceProfile.price,
              city: serviceProfile.city,
              klyxScore: Number(serviceProfile.klyx_score ?? 50),
              completedJobs: Number(
                serviceProfile.completed_jobs ?? 0
              ),
              cancellationRate: Number(
                serviceProfile.cancellation_rate ?? 0
              ),
              slots:
                slotsByUserService.get(userService.id) ?? [],
            };
          })
          .filter((item): item is BabysitterCard => item !== null)
          .sort((a, b) => {
            if (b.klyxScore !== a.klyxScore) {
              return b.klyxScore - a.klyxScore;
            }

            return b.completedJobs - a.completedJobs;
          });

        setBabysitters(cards);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les baby-sitters."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBabysitters();
  }, []);

  const exactMatches = useMemo(() => {
    return babysitters.filter(
      (babysitter) =>
        matchesCity(babysitter, city) &&
        matchesBudget(babysitter, budget) &&
        matchesAvailability(babysitter, date, time)
    );
  }, [babysitters, budget, city, date, time]);

  const fallbackMatches = useMemo(() => {
    if (exactMatches.length > 0 || !hasFilters) {
      return [];
    }

    return babysitters
      .map((babysitter) => {
        let relevance = 0;

        if (matchesCity(babysitter, city)) relevance += 40;
        if (matchesBudget(babysitter, budget)) relevance += 30;
        if (matchesAvailability(babysitter, date, time)) relevance += 30;

        return {
          babysitter,
          relevance,
        };
      })
      .sort((a, b) => {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }

        return b.babysitter.klyxScore - a.babysitter.klyxScore;
      })
      .map((item) => item.babysitter);
  }, [
    babysitters,
    budget,
    city,
    date,
    exactMatches.length,
    hasFilters,
    time,
  ]);

  const displayedBabysitters =
    exactMatches.length > 0
      ? exactMatches
      : hasFilters
        ? fallbackMatches
        : babysitters;

  const showingAlternatives =
    hasFilters &&
    exactMatches.length === 0 &&
    fallbackMatches.length > 0;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/request"
              className="text-sm text-zinc-400 hover:text-white"
            >
              Modifier ma demande
            </Link>

            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
              Baby-sitters recommandées
            </h1>

            <p className="mt-3 max-w-2xl text-zinc-400">
              KLYX compare la disponibilité, le prix, la ville et le
              score de confiance.
            </p>
          </div>

          <Link
            href="/request"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-900"
          >
            <SlidersHorizontal size={18} />
            Nouvelle recherche
          </Link>
        </div>

        <section className="mt-8 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:grid-cols-4">
          <FilterSummary
            icon={<MapPin size={18} />}
            label="Ville"
            value={city || "Toutes"}
          />

          <FilterSummary
            icon={<CalendarDays size={18} />}
            label="Date"
            value={date || "Toutes"}
          />

          <FilterSummary
            icon={<Clock3 size={18} />}
            label="Heure"
            value={time || "Toutes"}
          />

          <FilterSummary
            icon={<Search size={18} />}
            label="Budget"
            value={
              budget !== null && Number.isFinite(budget)
                ? `${budget.toFixed(2)} €/h max`
                : "Tous"
            }
          />
        </section>

        {loading && (
          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            KLYX classe les meilleurs profils...
          </div>
        )}

        {errorMessage && (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && showingAlternatives && (
          <div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />

            <div>
              <p className="font-semibold">
                Aucun profil ne correspond à tous les critères.
              </p>

              <p className="mt-1 text-sm text-amber-100/80">
                KLYX affiche les profils les plus proches de ta demande,
                classés par pertinence et score de confiance.
              </p>
            </div>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          displayedBabysitters.length === 0 && (
            <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <h2 className="text-xl font-bold">
                Aucun profil disponible
              </h2>

              <p className="mt-3 text-zinc-400">
                Aucun prestataire actif n’est actuellement disponible.
              </p>

              <Link
                href="/request"
                className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"
              >
                Modifier la demande
              </Link>
            </div>
          )}

        {!loading && displayedBabysitters.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {displayedBabysitters.length} profil
                {displayedBabysitters.length > 1 ? "s" : ""} affiché
                {displayedBabysitters.length > 1 ? "s" : ""}
              </p>

              <p className="inline-flex items-center gap-2 text-sm text-violet-300">
                <ShieldCheck size={16} />
                Classés par score KLYX
              </p>
            </div>

            <section className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayedBabysitters.map((babysitter, index) => (
                <BabysitterCardView
                  key={babysitter.userServiceId}
                  babysitter={babysitter}
                  recommended={index === 0}
                />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function BabysitterCardView({
  babysitter,
  recommended,
}: {
  babysitter: BabysitterCard;
  recommended: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="relative flex h-52 items-center justify-center bg-zinc-800">
        {babysitter.avatarUrl ? (
          <img
            src={babysitter.avatarUrl}
            alt={`${babysitter.firstName} ${babysitter.lastName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={60} className="text-zinc-500" />
        )}

        {recommended && (
          <div className="absolute left-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold">
            Recommandé par KLYX
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-400">
              Baby-sitter
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {[babysitter.firstName, babysitter.lastName]
                .filter(Boolean)
                .join(" ") || "Baby-sitter KLYX"}
            </h2>
          </div>

          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-violet-300">
              {babysitter.klyxScore.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-400">/100</p>
          </div>
        </div>

        <p className="mt-2 text-sm font-semibold text-violet-300">
          {scoreLabel(babysitter.klyxScore)}
        </p>

        <div className="mt-4 space-y-2 text-sm text-zinc-400">
          <p className="flex items-center gap-2">
            <MapPin size={16} />
            {babysitter.city || "Ville non renseignée"}
          </p>

          <p className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {babysitter.completedJobs} prestation
            {babysitter.completedJobs > 1 ? "s" : ""} terminée
            {babysitter.completedJobs > 1 ? "s" : ""}
          </p>

          <p>
            Taux d’annulation :{" "}
            {babysitter.cancellationRate.toFixed(1)} %
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-lg font-bold text-violet-400">
            {babysitter.price !== null
              ? `${Number(babysitter.price).toFixed(2)} €/h`
              : "Prix à confirmer"}
          </p>

          <Link
            href={`/babysitters/${babysitter.userId}`}
            className="rounded-xl bg-white px-4 py-2 font-semibold text-black hover:bg-zinc-200"
          >
            Voir le profil
          </Link>
        </div>
      </div>
    </article>
  );
}

function FilterSummary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        {icon}
        {label}
      </div>

      <p className="mt-2 truncate font-semibold">{value}</p>
    </div>
  );
}

export default function BabysittersPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
          Chargement...
        </main>
      }
    >
      <BabysittersContent />
    </Suspense>
  );
}