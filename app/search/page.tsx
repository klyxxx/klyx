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

import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxSearchBudget,
  formatKlyxSearchComparedProfiles,
  formatKlyxSearchExperience,
  formatKlyxSearchJobs,
  formatKlyxSearchPricingOption,
  formatKlyxSearchProviderPrice,
  formatKlyxSearchResultSummary,
  formatKlyxSearchReviewCount,
  formatKlyxSearchScoreLabel,
  formatKlyxSearchServiceLabel,
  formatKlyxSearchSortOption,
  formatKlyxSearchWhen,
  translateKlyxSearchPage,
  type KlyxSearchPageMessageKey,
} from "@/lib/klyx-search-page-i18n";
import {
  DEFAULT_SERVICE_OPTIONS,
  PRICING_OPTIONS,
  SORT_OPTIONS,
  type PublicServiceOption,
  type ProviderSearchItem,
  type ProviderSearchResponse,
  type ProviderSearchSort,
} from "@/lib/provider-search";
import MatchExplanation from "./MatchExplanation";
import SearchRecovery from "./SearchRecovery";

// KLYX_SEARCH_PAGE_I18N
// KLYX_SEARCH_PAGE_READ_ONLY

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

type SearchErrorKey = "loadError" | "invalidTimeRange";

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
      params.get("start")?.trim() || params.get("time")?.trim() || "",
    endTime: params.get("end")?.trim() || "",
    budget: params.get("budget")?.trim() || "",
    pricing: params.get("pricing")?.trim() || "all",
    sort: SORT_OPTIONS.some((option) => option.value === requestedSort)
      ? (requestedSort as ProviderSearchSort)
      : "recommended",
  };
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
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSearchPageMessageKey) => translateKlyxSearchPage(locale, key);
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
  const [errorKey, setErrorKey] = useState<SearchErrorKey | null>(null);
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
        // Keep the built-in "all" fallback if public services cannot be loaded.
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
      setErrorKey(null);

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
          throw new Error("KLYX_SEARCH_LOAD_FAILED");
        }

        setResult(body);
      } catch {
        if (controller.signal.aborted) return;

        setResult(EMPTY_RESPONSE);
        setErrorKey("loadError");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProviders();

    return () => controller.abort();
  }, [queryString, reloadKey]);

  const selectedServiceOption = serviceOptions.find(
    (service) => service.value === appliedFilters.service
  );
  const serviceTitle = formatKlyxSearchServiceLabel(
    locale,
    appliedFilters.service,
    selectedServiceOption?.label ?? appliedFilters.service
  );
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

    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      setErrorKey("invalidTimeRange");
      return;
    }

    setErrorKey(null);

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
              {t("marketplaceEyebrow")}
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">{t("title")}</h1>
          </div>

          {/* KLYX_SEARCH_ASSISTANT_BRIDGE_13_93 */}
          <Link
            href="/assistant/market"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 font-semibold text-violet-700 hover:bg-violet-500/15 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-500/20"
          >
            <Search size={18} />
            {t("assistantBridge")}
          </Link>
        </div>

        {/* KLYX_AI_FIRST_SEARCH_15_02 */}
        <form
          onSubmit={submitSearch}
          className="mt-8 min-w-0 overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <SlidersHorizontal size={20} className="text-violet-400" />
              {t("criteriaTitle")}
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={16} />
              {t("reset")}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label={t("service")} icon={<Search size={17} />}>
              <KlyxSelect
                value={draft.service}
                onChange={(value) => updateDraft("service", value)}
                options={serviceOptions.map((option) => ({
                  value: option.value,
                  label: formatKlyxSearchServiceLabel(
                    locale,
                    option.value,
                    option.label
                  ),
                }))}
                ariaLabel={t("service")}
              />
            </FilterField>

            <FilterField label={t("city")} icon={<MapPin size={17} />}>
              <input
                value={draft.city}
                onChange={(event) => updateDraft("city", event.target.value)}
                placeholder={t("cityPlaceholder")}
                maxLength={80}
                className="filter-control"
              />
            </FilterField>

            <FilterField label={t("date")} icon={<CalendarDays size={17} />}>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => updateDraft("date", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label={t("startTime")} icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.startTime}
                onChange={(event) => updateDraft("startTime", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label={t("endTime")} icon={<Clock3 size={17} />}>
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
                  {t("advancedFilters")}
                </span>
                <span className="text-muted-foreground dark:text-zinc-500">
                  {showAdvancedFilters ? t("hide") : t("show")}
                </span>
              </button>
            </div>

            <div
              className={`grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-3 ${
                showAdvancedFilters ? "grid" : "hidden md:grid"
              }`}
            >
              <FilterField label={t("maxPrice")} icon={<Euro size={17} />}>
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

              <FilterField label={t("pricingType")} icon={<Euro size={17} />}>
                <KlyxSelect
                  value={draft.pricing}
                  onChange={(value) => updateDraft("pricing", value)}
                  options={PRICING_OPTIONS.map((option) => ({
                    value: option.value,
                    label: formatKlyxSearchPricingOption(
                      locale,
                      option.value,
                      option.label
                    ),
                  }))}
                  ariaLabel={t("pricingType")}
                />
              </FilterField>

              <FilterField label={t("sortBy")} icon={<ShieldCheck size={17} />}>
                <KlyxSelect
                  value={draft.sort}
                  onChange={(value) =>
                    updateDraft("sort", value as ProviderSearchSort)
                  }
                  options={SORT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: formatKlyxSearchSortOption(
                      locale,
                      option.value,
                      option.label
                    ),
                  }))}
                  ariaLabel={t("sortBy")}
                />
              </FilterField>
            </div>
          </div>

          <button
            type="submit"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-semibold text-white hover:bg-violet-700"
          >
            <Search size={19} />
            {t("searchButton")}
          </button>
        </form>

        <section className="mt-4 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <FilterSummary
            icon={<Search size={17} />}
            label={t("service")}
            value={serviceTitle}
          />
          <FilterSummary
            icon={<MapPin size={17} />}
            label={t("zone")}
            value={appliedFilters.city || t("allZones")}
          />
          <FilterSummary
            icon={<CalendarDays size={17} />}
            label={t("when")}
            value={formatKlyxSearchWhen(
              locale,
              appliedFilters.date,
              appliedFilters.startTime,
              appliedFilters.endTime
            )}
          />
          <FilterSummary
            icon={<Euro size={17} />}
            label={t("budget")}
            value={formatKlyxSearchBudget(locale, appliedFilters.budget)}
          />
        </section>

        {loading && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t("loading")}
          </div>
        )}

        {!loading && errorKey && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">{t("searchUnavailable")}</p>
                <p className="mt-1 text-sm">{t(errorKey)}</p>
                {errorKey === "loadError" && (
                  <button
                    type="button"
                    onClick={() => setReloadKey((key) => key + 1)}
                    className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold hover:bg-red-500/10"
                  >
                    {t("retry")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !errorKey && result.showingAlternatives && (
          <>
            <div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-800 dark:text-amber-200">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">{t("alternativesTitle")}</p>
                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-100/80">
                  {t("alternativesText")}
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

        {!loading && !errorKey && result.providers.length === 0 && (
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

            <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-2xl font-bold">{t("noProvidersTitle")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground dark:text-zinc-400">
                {t("noProvidersText")}
              </p>
              {hasCommercialFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-6 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
                >
                  {t("seeAllProviders")}
                </button>
              )}
            </div>
          </>
        )}

        {!loading && !errorKey && result.providers.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground dark:text-zinc-400">
                <strong className="text-foreground dark:text-white">
                  {formatKlyxSearchResultSummary(
                    locale,
                    result.showingAlternatives
                      ? result.providers.length
                      : result.exactCount,
                    result.totalCandidates
                  )}
                </strong>
              </p>
              <p className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-300">
                <ShieldCheck size={16} />
                {t("publishedOnly")}
              </p>
            </div>

            {/* KLYX_MARKET_DECISION_SUMMARY_13_75 */}
            {(() => {
              const highestScore = [...result.providers].sort(
                (a, b) => b.klyxScore - a.klyxScore
              )[0];
              const bestRated =
                [...result.providers]
                  .filter((provider) => provider.reviewCount > 0)
                  .sort(
                    (a, b) =>
                      b.rating - a.rating || b.reviewCount - a.reviewCount
                  )[0] ?? null;
              const cheapest =
                [...result.providers]
                  .filter((provider) => provider.price !== null)
                  .sort((a, b) => Number(a.price) - Number(b.price))[0] ?? null;
              const displayProviderName = (provider: ProviderSearchItem) =>
                provider.businessName ||
                [provider.firstName, provider.lastName].filter(Boolean).join(" ") ||
                t("providerFallback");

              return (
                <section className="mt-5 overflow-hidden rounded-3xl border border-violet-500/20 bg-violet-500/5">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                          {t("comparisonEyebrow")}
                        </p>
                        <h2 className="mt-2 text-xl font-black sm:text-2xl">
                          {t("comparisonTitle")}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                          {t("comparisonText")}
                        </p>
                      </div>

                      <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black">
                        {formatKlyxSearchComparedProfiles(
                          locale,
                          result.providers.length
                        )}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <Link
                        href={`/providers/${highestScore.profileId}`}
                        className="rounded-2xl border border-violet-500/20 bg-background p-4 transition hover:border-violet-500/40"
                      >
                        <p className="text-xs font-black uppercase tracking-wide text-violet-600 dark:text-violet-400">
                          {t("bestScore")}
                        </p>
                        <p className="mt-2 truncate font-black">
                          {displayProviderName(highestScore)}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <ShieldCheck size={17} className="text-violet-500" />
                          <span className="text-xl font-black">
                            {highestScore.klyxScore.toFixed(0)}/100
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatKlyxSearchScoreLabel(locale, highestScore.klyxScore)}
                        </p>
                      </Link>

                      {bestRated ? (
                        <Link
                          href={`/providers/${bestRated.profileId}`}
                          className="rounded-2xl border border-amber-500/20 bg-background p-4 transition hover:border-amber-500/40"
                        >
                          <p className="text-xs font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            {t("bestRated")}
                          </p>
                          <p className="mt-2 truncate font-black">
                            {displayProviderName(bestRated)}
                          </p>
                          <p className="mt-3 text-xl font-black">
                            {bestRated.rating.toFixed(1)}/5
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatKlyxSearchReviewCount(locale, bestRated.reviewCount)}
                          </p>
                        </Link>
                      ) : (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                            {t("bestRated")}
                          </p>
                          <p className="mt-2 font-black">{t("insufficientReviews")}</p>
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            {t("insufficientReviewsText")}
                          </p>
                        </div>
                      )}

                      {cheapest ? (
                        <Link
                          href={`/providers/${cheapest.profileId}`}
                          className="rounded-2xl border border-emerald-500/20 bg-background p-4 transition hover:border-emerald-500/40"
                        >
                          <p className="text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            {t("lowestPrice")}
                          </p>
                          <p className="mt-2 truncate font-black">
                            {displayProviderName(cheapest)}
                          </p>
                          <p className="mt-3 text-xl font-black">
                            {formatKlyxSearchProviderPrice(
                              locale,
                              cheapest.price,
                              cheapest.pricingType
                            )}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t("currentResults")}
                          </p>
                        </Link>
                      ) : (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                            {t("lowestPrice")}
                          </p>
                          <p className="mt-2 font-black">{t("priceConfirm")}</p>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {t("noComparablePrice")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-border bg-background/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
                      {t("decisionNotice")}
                    </div>
                  </div>
                </section>
              );
            })()}

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
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSearchPageMessageKey) => translateKlyxSearchPage(locale, key);
  const fullName =
    [provider.firstName, provider.lastName].filter(Boolean).join(" ") ||
    t("providerFallback");
  const displayName = provider.businessName || fullName;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative flex h-52 items-center justify-center bg-muted dark:bg-zinc-800">
        {provider.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={provider.avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={60} className="text-muted-foreground dark:text-zinc-500" />
        )}

        {recommended && (
          <div className="absolute left-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
            {t("recommended")}
          </div>
        )}
        {!provider.isExactMatch && (
          <div className="absolute right-4 top-4 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black">
            {t("alternative")}
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-400">
              {formatKlyxSearchServiceLabel(
                locale,
                provider.serviceSlug,
                provider.serviceLabel
              )}
            </p>
            <h2 className="mt-2 truncate text-2xl font-bold">{displayName}</h2>
            {provider.businessName && (
              <p className="mt-1 truncate text-sm text-muted-foreground dark:text-zinc-400">
                {fullName}
              </p>
            )}
          </div>

          <div className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
              {provider.klyxScore.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground dark:text-zinc-400">/100</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-violet-700 dark:text-violet-300">
            {formatKlyxSearchScoreLabel(locale, provider.klyxScore)}
          </span>
          {provider.isVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              <BadgeCheck size={14} /> {t("verified")}
            </span>
          )}
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground dark:text-zinc-400">
          {provider.title || provider.headline || t("professionalFallback")}
        </p>

        <div className="mt-4 space-y-2 text-sm text-foreground/80 dark:text-zinc-300">
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-muted-foreground dark:text-zinc-500" />
            {provider.city || provider.serviceArea[0] || t("zoneConfirm")}
            {provider.travelRadiusKm > 0 && ` · ${provider.travelRadiusKm} km`}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 size={16} className="text-muted-foreground dark:text-zinc-500" />
            {provider.availabilitySummary}
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-muted-foreground dark:text-zinc-500" />
            {formatKlyxSearchExperience(locale, provider.yearsExperience)} ·{" "}
            {formatKlyxSearchJobs(locale, provider.completedJobs)}
          </p>
        </div>

        {/* KLYX_MARKET_TRUST_EXPLAINER_13_73 */}
        <div className="mt-5 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
                {t("trustEyebrow")}
              </p>
              <p className="mt-1 text-sm font-black">{t("whyProfile")}</p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-background px-3 py-1.5 text-xs font-black">
              <ShieldCheck size={14} />
              {provider.klyxScore.toFixed(0)}/100
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <TrustSignal
              label={t("identity")}
              value={provider.isVerified ? t("verifiedStatus") : t("confirmStatus")}
              positive={provider.isVerified}
            />
            <TrustSignal
              label={t("experience")}
              value={formatKlyxSearchExperience(locale, provider.yearsExperience)}
              positive={provider.yearsExperience > 0}
            />
            <TrustSignal
              label={t("jobs")}
              value={formatKlyxSearchJobs(locale, provider.completedJobs, true)}
              positive={provider.completedJobs > 0}
            />
            {/* KLYX_MARKET_VERIFIED_REVIEWS_13_74 */}
            <TrustSignal
              label={t("verifiedReviews")}
              value={
                provider.reviewCount > 0
                  ? `${provider.rating.toFixed(1)}/5 · ${formatKlyxSearchReviewCount(
                      locale,
                      provider.reviewCount
                    )}`
                  : t("noReviews")
              }
              positive={provider.reviewCount > 0}
            />
            <TrustSignal
              label={t("availability")}
              value={provider.availabilitySummary}
              positive={true}
            />
          </div>

          {recommended && (
            <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">{t("recommendedPrefix")}</strong>{" "}
              {t("recommendedText")}
            </div>
          )}
        </div>

        <p className="mt-5 text-xl font-bold text-violet-600 dark:text-violet-400">
          {formatKlyxSearchProviderPrice(
            locale,
            provider.price,
            provider.pricingType
          )}
        </p>

        <MatchExplanation provider={provider} filters={matchingFilters} />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href={`/providers/${provider.profileId}`}
            className="rounded-xl border border-border px-4 py-3 text-center font-semibold hover:bg-muted dark:border-zinc-700 dark:bg-zinc-800"
          >
            {t("viewProfile")}
          </Link>
          <Link
            href={bookingUrl}
            className="rounded-xl bg-white px-4 py-3 text-center font-semibold text-black hover:bg-zinc-200"
          >
            {t("book")}
          </Link>
        </div>
      </div>
    </article>
  );
}

function TrustSignal({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex items-start gap-1.5">
        {positive ? (
          <CheckCircle2
            size={14}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
        ) : (
          <AlertCircle
            size={14}
            className="mt-0.5 shrink-0 text-amber-500"
          />
        )}
        <p className="min-w-0 text-xs font-black leading-5">{value}</p>
      </div>
    </div>
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
  const { locale } = useKlyxLocale();

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
          {translateKlyxSearchPage(locale, "searchLoading")}
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
