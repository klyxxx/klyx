"use client";

import {
  type FormEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import {
  formatProviderPrice,
  PRICING_OPTIONS,
  scoreLabel,
  SERVICE_OPTIONS,
  SORT_OPTIONS,
  type ProviderSearchItem,
  type ProviderSearchResponse,
  type ProviderSearchSort,
} from "@/lib/provider-search";
import MatchExplanation from "./MatchExplanation";

type DraftFilters = {
  service: string;
  city: string;
  date: string;
  time: string;
  duration: string;
  budget: string;
  pricing: string;
  sort: ProviderSearchSort;
};

const EMPTY_RESPONSE: ProviderSearchResponse = {
  providers: [],
  exactCount: 0,
  totalCandidates: 0,
  showingAlternatives: false,
};

function filtersFromParams(params: { get(name: string): string | null }): DraftFilters {
  const requestedSort = params.get("sort");

  return {
    service: params.get("service")?.trim() || "all",
    city: params.get("city")?.trim() || "",
    date: params.get("date")?.trim() || "",
    time: params.get("time")?.trim() || "",
    duration: params.get("duration")?.trim() || "1",
    budget: params.get("budget")?.trim() || "",
    pricing: params.get("pricing")?.trim() || "all",
    sort: SORT_OPTIONS.some((option) => option.value === requestedSort)
      ? (requestedSort as ProviderSearchSort)
      : "recommended",
  };
}

function dateLabel(value: string): string {
  if (!value) return "Toutes les dates";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function bookingHref(provider: ProviderSearchItem, filters: DraftFilters): string {
  const params = new URLSearchParams({ service: provider.serviceSlug });

  if (filters.date) params.set("date", filters.date);
  if (filters.time) {
    params.set("time", filters.time);
    params.set("duration", filters.duration || "1");
  }

  return `/providers/${provider.profileId}/book?${params.toString()}`;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const appliedFilters = useMemo(
    () => filtersFromParams(new URLSearchParams(queryString)),
    [queryString]
  );
  const [draft, setDraft] = useState<DraftFilters>(() =>
    filtersFromParams(searchParams)
  );
  const [result, setResult] = useState<ProviderSearchResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setDraft(filtersFromParams(new URLSearchParams(queryString)));
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [queryString]);

  useEffect(() => {

    const controller = new AbortController();

    async function loadProviders() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          queryString
            ? `/api/search/providers?${queryString}`
            : "/api/search/providers",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const body = (await response.json()) as ProviderSearchResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || "Recherche impossible.");
        }

        setResult(body);
      } catch (error) {
        if (controller.signal.aborted) return;

        setResult(EMPTY_RESPONSE);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les prestataires."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProviders();

    return () => controller.abort();
  }, [queryString, reloadKey]);

  const serviceTitle =
    SERVICE_OPTIONS.find((service) => service.value === appliedFilters.service)
      ?.label ?? "Tous les services";
  const hasCommercialFilters = Boolean(
    appliedFilters.city ||
      appliedFilters.date ||
      appliedFilters.time ||
      appliedFilters.budget ||
      appliedFilters.pricing !== "all"
  );

  function updateDraft<Key extends keyof DraftFilters>(
    key: Key,
    value: DraftFilters[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();

    if (draft.service !== "all") params.set("service", draft.service);
    if (draft.city.trim()) params.set("city", draft.city.trim());
    if (draft.date) params.set("date", draft.date);
    if (draft.time) {
      params.set("time", draft.time);
      params.set("duration", draft.duration || "1");
    }
    if (draft.budget && Number(draft.budget) >= 0) {
      params.set("budget", draft.budget);
    }
    if (draft.pricing !== "all") params.set("pricing", draft.pricing);
    if (draft.sort !== "recommended") params.set("sort", draft.sort);

    const nextQuery = params.toString();
    router.replace(nextQuery ? `/search?${nextQuery}` : "/search", {
      scroll: false,
    });
  }

  function resetFilters() {
    setDraft(filtersFromParams({ get: () => null }));
    router.replace("/search", { scroll: false });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
              Marketplace KLYX
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
              Trouver un prestataire
            </h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Compare les profils publiés selon la zone, le tarif, les horaires
              et le score de confiance.
            </p>
          </div>

          <Link
            href="/request"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-3 font-semibold text-violet-200 hover:bg-violet-500/20"
          >
            <Search size={18} />
            Décrire mon besoin à KLYX
          </Link>
        </div>

        <form
          onSubmit={submitSearch}
          className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <SlidersHorizontal size={20} className="text-violet-400" />
              Critères de recherche
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
            >
              <RotateCcw size={16} />
              Réinitialiser
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Service" icon={<Search size={17} />}>
              <select
                value={draft.service}
                onChange={(event) => updateDraft("service", event.target.value)}
                className="filter-control"
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Ville ou zone" icon={<MapPin size={17} />}>
              <input
                value={draft.city}
                onChange={(event) => updateDraft("city", event.target.value)}
                placeholder="Bruxelles, Anderlecht..."
                maxLength={80}
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Date" icon={<CalendarDays size={17} />}>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => updateDraft("date", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Heure souhaitée" icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.time}
                onChange={(event) => updateDraft("time", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Durée" icon={<Clock3 size={17} />}>
              <select
                value={draft.duration}
                disabled={!draft.time}
                onChange={(event) => updateDraft("duration", event.target.value)}
                className="filter-control disabled:cursor-not-allowed disabled:opacity-50"
              >
                {[1, 2, 3, 4, 6, 8].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} heure{hours > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Prix maximum" icon={<Euro size={17} />}>
              <input
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={draft.budget}
                onChange={(event) => updateDraft("budget", event.target.value)}
                placeholder="80"
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Type de tarif" icon={<Euro size={17} />}>
              <select
                value={draft.pricing}
                onChange={(event) => updateDraft("pricing", event.target.value)}
                className="filter-control"
              >
                {PRICING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Trier par" icon={<ShieldCheck size={17} />}>
              <select
                value={draft.sort}
                onChange={(event) =>
                  updateDraft("sort", event.target.value as ProviderSearchSort)
                }
                className="filter-control"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          <button
            type="submit"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-semibold hover:bg-violet-700"
          >
            <Search size={19} />
            Rechercher les prestataires
          </button>
        </form>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSummary
            icon={<Search size={17} />}
            label="Service"
            value={serviceTitle}
          />
          <FilterSummary
            icon={<MapPin size={17} />}
            label="Zone"
            value={appliedFilters.city || "Toutes les zones"}
          />
          <FilterSummary
            icon={<CalendarDays size={17} />}
            label="Quand"
            value={`${dateLabel(appliedFilters.date)}${
              appliedFilters.time ? ` à ${appliedFilters.time}` : ""
            }`}
          />
          <FilterSummary
            icon={<Euro size={17} />}
            label="Budget"
            value={
              appliedFilters.budget
                ? `${Number(appliedFilters.budget).toFixed(2)} € maximum`
                : "Tous les prix"
            }
          />
        </section>

        {loading && (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            KLYX vérifie les profils publiés et leurs disponibilités...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">Recherche indisponible</p>
                <p className="mt-1 text-sm">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold hover:bg-red-500/10"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !errorMessage && result.showingAlternatives && (
          <div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">
                Aucun profil ne correspond exactement à tous les critères.
              </p>
              <p className="mt-1 text-sm text-amber-100/80">
                KLYX affiche les alternatives les plus proches. Modifie un filtre
                pour élargir davantage la recherche.
              </p>
            </div>
          </div>
        )}

        {!loading && !errorMessage && result.providers.length === 0 && (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-bold">Aucun prestataire publié</h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              Aucun service actif ne correspond encore à cette recherche. Essaie
              une autre zone ou retire certains critères.
            </p>
            {hasCommercialFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"
              >
                Voir tous les prestataires
              </button>
            )}
          </div>
        )}

        {!loading && !errorMessage && result.providers.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                <strong className="text-white">
                  {result.showingAlternatives
                    ? result.providers.length
                    : result.exactCount}
                </strong>{" "}
                résultat{result.providers.length > 1 ? "s" : ""}
                {result.totalCandidates > result.providers.length &&
                  ` sur ${result.totalCandidates} services publiés`}
              </p>
              <p className="inline-flex items-center gap-2 text-sm text-violet-300">
                <ShieldCheck size={16} />
                Profils publiés uniquement
              </p>
            </div>

            <section className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {result.providers.map((provider, index) => (
                <ProviderCardView
                  key={provider.userServiceId}
                  provider={provider}
                  bookingUrl={bookingHref(provider, appliedFilters)}
                  matchingFilters={{
                    city: appliedFilters.city,
                    date: appliedFilters.date,
                    time: appliedFilters.time,
                    duration: appliedFilters.duration,
                    budget: appliedFilters.budget,
                    pricing: appliedFilters.pricing,
                  }}
                  recommended={
                    !result.showingAlternatives &&
                    appliedFilters.sort === "recommended" &&
                    index === 0
                  }
                />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ProviderCardView({
  provider,
  bookingUrl,
  matchingFilters,
  recommended,
}: {
  provider: ProviderSearchItem;
  bookingUrl: string;
  matchingFilters: {
    city: string;
    date: string;
    time: string;
    duration: string;
    budget: string;
    pricing: string;
  };
  recommended: boolean;
}) {
  const fullName =
    [provider.firstName, provider.lastName].filter(Boolean).join(" ") ||
    "Prestataire KLYX";
  const displayName = provider.businessName || fullName;

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div className="relative flex h-52 items-center justify-center bg-zinc-800">
        {provider.avatarUrl ? (
          <img
            src={provider.avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={60} className="text-zinc-500" />
        )}

        {recommended && (
          <div className="absolute left-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold shadow-lg">
            Recommandé par KLYX
          </div>
        )}
        {!provider.isExactMatch && (
          <div className="absolute right-4 top-4 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black">
            Alternative
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-400">
              {provider.serviceLabel}
            </p>
            <h2 className="mt-2 truncate text-2xl font-bold">{displayName}</h2>
            {provider.businessName && (
              <p className="mt-1 truncate text-sm text-zinc-400">{fullName}</p>
            )}
          </div>

          <div className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-violet-300">
              {provider.klyxScore.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-400">/100</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-violet-300">
            {scoreLabel(provider.klyxScore)}
          </span>
          {provider.isVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300">
              <BadgeCheck size={14} /> Vérifié
            </span>
          )}
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-zinc-400">
          {provider.title || provider.headline || "Service professionnel KLYX"}
        </p>

        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-zinc-500" />
            {provider.city || provider.serviceArea[0] || "Zone à confirmer"}
            {provider.travelRadiusKm > 0 && ` · ${provider.travelRadiusKm} km`}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 size={16} className="text-zinc-500" />
            {provider.availabilitySummary}
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-zinc-500" />
            {provider.yearsExperience} an
            {provider.yearsExperience > 1 ? "s" : ""} d’expérience ·{" "}
            {provider.completedJobs} prestation
            {provider.completedJobs > 1 ? "s" : ""}
          </p>
        </div>

        <p className="mt-5 text-xl font-bold text-violet-400">
          {formatProviderPrice(provider.price, provider.pricingType)}
        </p>

        <MatchExplanation
          provider={provider}
          filters={matchingFilters}
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href={`/providers/${provider.profileId}`}
            className="rounded-xl border border-zinc-700 px-4 py-3 text-center font-semibold hover:bg-zinc-800"
          >
            Voir le profil
          </Link>
          <Link
            href={bookingUrl}
            className="rounded-xl bg-white px-4 py-3 text-center font-semibold text-black hover:bg-zinc-200"
          >
            Réserver
          </Link>
        </div>
      </div>
    </article>
  );
}

function FilterField({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterSummary({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate font-semibold">{value}</p>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
          Chargement de la recherche...
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

