"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import type { KlyxLocale } from "@/lib/klyx-i18n";
import {
  formatKlyxRecommendationExperience,
  formatKlyxRecommendationMissions,
  formatKlyxRecommendationPrice,
  formatKlyxRecommendationScore,
  formatKlyxRecommendationService,
  translateKlyxRecommendations,
  type KlyxRecommendationsMessageKey,
} from "@/lib/klyx-recommendations-page-i18n";
import {
  serviceLabel,
  type ProviderSearchItem,
  type ProviderSearchResponse,
} from "@/lib/provider-search";

// KLYX_RECOMMENDATIONS_PAGE_I18N
// KLYX_RECOMMENDATIONS_READ_ONLY
// KLYX_RECOMMENDATIONS_ASSISTANT_FIRST_20260911
// KLYX_CONVERSATIONAL_RESULT_20260911

const EMPTY_RESPONSE: ProviderSearchResponse = {
  providers: [],
  exactCount: 0,
  totalCandidates: 0,
  showingAlternatives: false,
};

function bookingHref(
  provider: ProviderSearchItem,
  params: URLSearchParams
) {
  const bookingParams = new URLSearchParams({
    service: provider.serviceSlug,
  });

  const date = params.get("date");
  const legacyStart = params.get("start");
  const time = params.get("time") || legacyStart;
  const end = params.get("end");
  const duration = params.get("duration");

  if (date) bookingParams.set("date", date);
  if (time) bookingParams.set("time", time);
  if (legacyStart) bookingParams.set("start", legacyStart);
  if (end) bookingParams.set("end", end);
  if (duration) bookingParams.set("duration", duration);

  return `/providers/${provider.profileId}/book?${bookingParams.toString()}`;
}

function providerDisplayName(
  provider: ProviderSearchItem,
  fallback: string
): string {
  return (
    provider.businessName ||
    `${provider.firstName} ${provider.lastName}`.trim() ||
    fallback
  );
}

function providerDisplayedService(
  provider: ProviderSearchItem,
  locale: KlyxLocale
): string {
  return (
    provider.title ||
    formatKlyxRecommendationService(
      locale,
      provider.serviceSlug,
      provider.serviceLabel
    )
  );
}

function RecommendationsContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxRecommendationsMessageKey) =>
    translateKlyxRecommendations(locale, key);
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const stableParams = useMemo(
    () => new URLSearchParams(queryString),
    [queryString]
  );

  const [result, setResult] =
    useState<ProviderSearchResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      setLoadError(false);
      setSelectedProviderId(null);

      try {
        const requestParams = new URLSearchParams(queryString);
        requestParams.set("sort", "recommended");

        const response = await fetch(
          `/api/search/providers?${requestParams.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const body = (await response.json()) as ProviderSearchResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error("KLYX_RECOMMENDATIONS_LOAD_FAILED");
        }

        setResult(body);
      } catch {
        if (controller.signal.aborted) return;
        setResult(EMPTY_RESPONSE);
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRecommendations();
    return () => controller.abort();
  }, [queryString]);

  const topProviders = result.providers.slice(0, 3);
  const selectedProvider =
    topProviders.find((provider) => provider.userServiceId === selectedProviderId) ??
    null;
  const service = stableParams.get("service");
  const city = stableParams.get("city");
  const date = stableParams.get("date");
  const time = stableParams.get("time") || stableParams.get("start");
  const budget = stableParams.get("budget");
  const displayedService = service
    ? formatKlyxRecommendationService(
        locale,
        service,
        serviceLabel(service, service)
      )
    : t("allServices");

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/request/confirm?${queryString}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("editRequest")}
        </Link>

        <section className="mt-8" data-testid="klyx-conversational-results">
          <div className="flex gap-3">
            <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
              K
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">KLYX</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                {t("recommendations")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("whyRecommended")}
              </p>
            </div>
          </div>

          <div
            data-testid="klyx-request-summary"
            className="ml-11 mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm"
            aria-label={t("requestSummary")}
          >
            <span className="font-semibold text-foreground">{displayedService}</span>
            {city && <span>· {city}</span>}
            {date && <span>· {date}</span>}
            {time && <span>· {time}</span>}
            {budget && (
              <span>
                · {budget} € {t("budgetMaximum")}
              </span>
            )}
          </div>
        </section>

        {loading && (
          <section className="ml-11 mt-8 min-h-44 border-y border-border py-10 text-center">
            <LoaderCircle
              size={28}
              className="mx-auto animate-spin text-blue-600"
            />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              {t("loading")}
            </p>
          </section>
        )}

        {!loading && loadError && (
          <section className="ml-11 mt-8 border-y border-red-500/20 py-6">
            <div className="flex gap-3 text-red-700 dark:text-red-300">
              <AlertCircle className="mt-0.5 shrink-0" size={19} />
              <div>
                <p className="font-semibold">{t("selectionUnavailable")}</p>
                <p className="mt-2 text-sm">{t("loadError")}</p>
              </div>
            </div>
          </section>
        )}

        {!loading && !loadError && topProviders.length === 0 && (
          <section className="ml-11 mt-8 border-y border-border py-10 text-center sm:py-12">
            <UserRound size={30} className="mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">{t("noProviderTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              {t("noProviderDescription")}
            </p>
            <Link
              href={`/request/confirm?${queryString}`}
              className="klyx-button mt-6 inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
            >
              {t("editRequest")}
              <ArrowRight size={16} />
            </Link>
          </section>
        )}

        {!loading && !loadError && topProviders.length > 0 && (
          <section className="ml-0 mt-7 sm:ml-11" aria-label={t("recommendations")}>
            {result.showingAlternatives && (
              <p className="mb-4 border-l-2 border-blue-600 pl-3 text-sm leading-6 text-muted-foreground">
                {t("alternativesDescription")}
              </p>
            )}

            <div
              role="radiogroup"
              aria-label={t("recommendations")}
              className="space-y-3"
            >
              {topProviders.map((provider, index) => (
                <ConversationalProviderOption
                  key={provider.userServiceId}
                  provider={provider}
                  locale={locale}
                  recommended={index === 0}
                  selected={selectedProviderId === provider.userServiceId}
                  onSelect={() => setSelectedProviderId(provider.userServiceId)}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-end border-t border-border pt-5">
              {selectedProvider ? (
                <Link
                  data-testid="klyx-continue-selected-provider"
                  href={bookingHref(selectedProvider, stableParams)}
                  className="klyx-button inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold"
                >
                  {t("chooseRecommendation")}
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white opacity-45"
                >
                  {t("chooseRecommendation")}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ConversationalProviderOption({
  provider,
  locale,
  recommended,
  selected,
  onSelect,
}: {
  provider: ProviderSearchItem;
  locale: KlyxLocale;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = (key: KlyxRecommendationsMessageKey) =>
    translateKlyxRecommendations(locale, key);
  const displayName = providerDisplayName(provider, t("providerFallback"));
  const displayedService = providerDisplayedService(provider, locale);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid="klyx-provider-option"
      className={`w-full rounded-2xl border px-4 py-4 text-left transition sm:px-5 ${
        selected
          ? "border-blue-600 bg-blue-600/[0.06] ring-1 ring-blue-600"
          : "border-border bg-background hover:border-blue-600/40 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {displayName}
            </span>
            {provider.isVerified && (
              <BadgeCheck
                size={16}
                className="shrink-0 text-blue-600 dark:text-blue-400"
                aria-label={t("verified")}
              />
            )}
            {recommended && (
              <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                {t("bestChoice")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{displayedService}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-foreground">
          {formatKlyxRecommendationPrice(
            locale,
            provider.price,
            provider.pricingType
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={15} className="text-blue-600" />
          {formatKlyxRecommendationScore(locale, provider.klyxScore)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={15} className="text-blue-600" />
          {provider.availabilitySummary || t("availabilityFallback")}
        </span>
      </div>

      <div className="mt-3 border-t border-border/70 pt-3">
        <p className="text-xs font-semibold text-foreground">{t("whyRecommended")}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Star size={14} />
            {formatKlyxRecommendationExperience(locale, provider.yearsExperience)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            {formatKlyxRecommendationMissions(locale, provider.completedJobs)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} />
            {provider.city || t("areaToConfirm")}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto grid min-h-56 max-w-3xl place-items-center border-y border-border">
            <LoaderCircle className="animate-spin text-blue-600" />
          </div>
        </main>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}
