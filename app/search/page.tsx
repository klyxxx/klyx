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
  DEFAULT_SERVICE_OPTIONS,
  formatProviderPrice,
  PRICING_OPTIONS,
  scoreLabel,
  SORT_OPTIONS,
  type PublicServiceOption,
  type ProviderSearchItem,
  type ProviderSearchResponse,
  type ProviderSearchSort,
} from "@/lib/provider-search";
import MatchExplanation from "./MatchExplanation";
import SearchRecovery from "./SearchRecovery";
import KlyxSelect from "@/app/components/KlyxSelect";

type DraftFilters = {
  service: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
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
    startTime:
      params.get("start")?.trim() ||
      params.get("time")?.trim() ||
      "",
    endTime: params.get("end")?.trim() || "",
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
  if (filters.startTime) params.set("start", filters.startTime);
  if (filters.endTime) params.set("end", filters.endTime);

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [serviceOptions, setServiceOptions] =
    useState<PublicServiceOption[]>(DEFAULT_SERVICE_OPTIONS);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServices() {
      try {
        const response = await fetch("/api/services/public", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          services?: PublicServiceOption[];
        };

        if (
          response.ok &&
          Array.isArray(body.services) &&
          body.services.length > 0
        ) {
          setServiceOptions(body.services);
        }
      } catch {
        // "Tous les services" reste disponible si le chargement échoue.
      }
    }

    void loadServices();
    return () => controller.abort();
  }, []);

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
    serviceOptions.find((service) => service.value === appliedFilters.service)
      ?.label ?? "Tous les services";
  const hasCommercialFilters = Boolean(
    appliedFilters.city ||
      appliedFilters.date ||
      appliedFilters.startTime ||
      appliedFilters.endTime ||
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

    if (
      draft.startTime &&
      draft.endTime &&
      draft.endTime <= draft.startTime
    ) {
      setErrorMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    setErrorMessage("");

    const params = new URLSearchParams();

    if (draft.service !== "all") params.set("service", draft.service);
    if (draft.city.trim()) params.set("city", draft.city.trim());
    if (draft.date) params.set("date", draft.date);
    if (draft.startTime) params.set("start", draft.startTime);
    if (draft.endTime) params.set("end", draft.endTime);
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
    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-5 text-foreground sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
              Marketplace KLYX
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
              Trouver un prestataire
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Compare les profils publiés selon la zone, le tarif, les horaires
              et le score de confiance.
            </p>
          </div>

          <Link
            href="/request"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 font-semibold text-violet-700 hover:bg-violet-500/15 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-500/20"
          >
            <Search size={18} />
            Décrire mon besoin à KLYX
          </Link>
        </div>

        <form
          onSubmit={submitSearch}
          className="mt-8 min-w-0 overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <SlidersHorizontal size={20} className="text-violet-400" />
              Critères de recherche
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={16} />
              Réinitialiser
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Service" icon={<Search size={17} />}>
              <KlyxSelect
                value={draft.service}
                onChange={(value) => updateDraft("service", value)}
                options={serviceOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Service"
              />
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

            <FilterField label="Heure de début" icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.startTime}
                onChange={(event) => updateDraft("startTime", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Heure de fin" icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.endTime}
                min={draft.startTime || undefined}
                onChange={(event) => updateDraft("endTime", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((current) => !current)}
                className="flex min-w-0 w-full items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
                aria-expanded={showAdvancedFilters}
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={17} />
                  Filtres avancés
                </span>
                <span className="text-muted-foreground dark:text-zinc-500">
                  {showAdvancedFilters ? "Masquer" : "Afficher"}
                </span>
              </button>
            </div>

            <div
              className={`grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-3 ${
                showAdvancedFilters ? "grid" : "hidden md:grid"
              }`}
            >
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
              <KlyxSelect
                value={draft.pricing}
                onChange={(value) => updateDraft("pricing", value)}
                options={PRICING_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Type de tarif"
              />
            </FilterField>

              <FilterField label="Trier par" icon={<ShieldCheck size={17} />}>
                <KlyxSelect
                  value={draft.sort}
                  onChange={(value) =>
                    updateDraft("sort", value as ProviderSearchSort)
                  }
                  options={SORT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  ariaLabel="Trier par"
                />
              </FilterField>
            </div>
          </div>

          <button
            type="submit"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-semibold text-white hover:bg-violet-700"
          >
            <Search size={19} />
            Rechercher les prestataires
          </button>
        </form>

        <section className="mt-4 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
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
              appliedFilters.startTime
                ? ` de ${appliedFilters.startTime}${
                    appliedFilters.endTime
                      ? ` à ${appliedFilters.endTime}`
                      : ""
                  }`
                : ""
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
          <div className="mt-8 rounded-2xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-8 text-center text-muted-foreground dark:text-zinc-400">
            KLYX vérifie les profils publiés et leurs disponibilités...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
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
          <>
            <div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-800 dark:text-amber-200">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">
                  Aucun profil ne correspond exactement à tous les critères.
                </p>
                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-100/80">
                  KLYX affiche les alternatives les plus proches et peut adapter
                  la recherche avec ton accord.
                </p>
              </div>
            </div>

            <SearchRecovery
              filters={{
                service: appliedFilters.service,
                city: appliedFilters.city,
                date: appliedFilters.date,
                startTime: appliedFilters.startTime,
                endTime: appliedFilters.endTime,
                budget: appliedFilters.budget,
                pricing: appliedFilters.pricing,
                sort: appliedFilters.sort,
              }}
              result={result}
            />
          </>
        )}

        {!loading && !errorMessage && result.providers.length === 0 && (
          <>
            <SearchRecovery
              filters={{
                service: appliedFilters.service,
                city: appliedFilters.city,
                date: appliedFilters.date,
                startTime: appliedFilters.startTime,
                endTime: appliedFilters.endTime,
                budget: appliedFilters.budget,
                pricing: appliedFilters.pricing,
                sort: appliedFilters.sort,
              }}
              result={result}
            />

            <div className="mt-8 rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-bold">Aucun prestataire publié</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground dark:text-zinc-400">
              Aucun service actif ne correspond encore à cette recherche. Essaie
              une autre zone ou retire certains critères.
            </p>
            {hasCommercialFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
              >
                Voir tous les prestataires
              </button>
            )}
            </div>
          </>
        )}

        {!loading && !errorMessage && result.providers.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground dark:text-zinc-400">
                <strong className="text-foreground dark:text-white">
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
                    startTime: appliedFilters.startTime,
                    endTime: appliedFilters.endTime,
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
    startTime: string;
    endTime: string;
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
    <article className="overflow-hidden rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900">
      <div className="relative flex h-52 items-center justify-center bg-muted dark:bg-zinc-800">
        {provider.avatarUrl ? (
          <img
            src={provider.avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={60} className="text-muted-foreground dark:text-zinc-500" />
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
              <p className="mt-1 truncate text-sm text-muted-foreground dark:text-zinc-400">{fullName}</p>
            )}
          </div>

          <div className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-violet-300">
              {provider.klyxScore.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground dark:text-zinc-400">/100</p>
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

        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground dark:text-zinc-400">
          {provider.title || provider.headline || "Service professionnel KLYX"}
        </p>

        <div className="mt-4 space-y-2 text-sm text-foreground/80 dark:text-zinc-300">
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-muted-foreground dark:text-zinc-500" />
            {provider.city || provider.serviceArea[0] || "Zone à confirmer"}
            {provider.travelRadiusKm > 0 && ` · ${provider.travelRadiusKm} km`}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 size={16} className="text-muted-foreground dark:text-zinc-500" />
            {provider.availabilitySummary}
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-muted-foreground dark:text-zinc-500" />
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
            className="rounded-xl border border-border dark:border-zinc-700 px-4 py-3 text-center font-semibold hover:bg-muted dark:bg-zinc-800"
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
    <label className="block min-w-0 overflow-hidden">
      <span className="mb-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="block min-w-0 max-w-full">{children}</span>
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
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
          Chargement de la recherche...
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}







