"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
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

function profileHref(provider: ProviderSearchItem) {
  return `/providers/${provider.profileId}`;
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      setLoadError(false);

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
  const primaryProvider = topProviders[0] ?? null;
  const alternativeProviders = topProviders.slice(1, 3);
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
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/request/confirm?${queryString}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("editRequest")}
        </Link>

        <section className="mt-7 max-w-3xl">
          <p className="klyx-eyebrow">{t("eyebrow")}</p>
          <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </section>

        <section
          data-testid="klyx-request-summary"
          className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-border py-3 text-sm"
          aria-label={t("requestSummary")}
        >
          <span className="font-semibold text-foreground">{displayedService}</span>
          {city && (
            <span className="text-muted-foreground">
              {t("city")}: {city}
            </span>
          )}
          {date && (
            <span className="text-muted-foreground">
              {t("date")}: {date}
            </span>
          )}
          {time && (
            <span className="text-muted-foreground">
              {t("time")}: {time}
            </span>
          )}
          {budget && (
            <span className="text-muted-foreground">
              {t("budget")}: {budget} € {t("budgetMaximum")}
            </span>
          )}
        </section>

        {loading && (
          <section className="mt-8 grid min-h-56 place-items-center border-y border-border py-10">
            <div className="text-center">
              <LoaderCircle
                size={30}
                className="mx-auto animate-spin text-blue-600"
              />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                {t("loading")}
              </p>
            </div>
          </section>
        )}

        {!loading && loadError && (
          <section className="mt-8 border-y border-red-500/20 py-6">
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
          <section className="mt-8 border-y border-border py-10 text-center sm:py-12">
            <UserRound size={30} className="mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-semibold">
              {t("noProviderTitle")}
            </h2>
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

        {!loading && !loadError && primaryProvider && (
          <>
            {result.showingAlternatives && (
              <div className="mt-7 max-w-3xl border-l-2 border-blue-600/40 pl-4">
                <p className="text-sm font-semibold text-foreground">
                  {t("alternativesTitle")}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("alternativesDescription")}
                </p>
              </div>
            )}

            <section className="mt-7" aria-label={t("bestChoice")}>
              <RecommendedProvider
                provider={primaryProvider}
                bookingUrl={bookingHref(primaryProvider, stableParams)}
                locale={locale}
              />
            </section>

            {alternativeProviders.length > 0 && (
              <details
                data-testid="klyx-secondary-options"
                className="group mt-7 border-y border-border"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold">
                  <span>
                    {t("otherOptions")} · {alternativeProviders.length}
                  </span>
                  <ChevronDown
                    size={17}
                    className="shrink-0 text-muted-foreground transition group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-border">
                  <p className="max-w-2xl py-4 text-sm leading-6 text-muted-foreground">
                    {t("otherOptionsDescription")}
                  </p>
                  <div className="border-t border-border">
                    {alternativeProviders.map((provider) => (
                      <AlternativeProviderRow
                        key={provider.userServiceId}
                        provider={provider}
                        bookingUrl={bookingHref(provider, stableParams)}
                        locale={locale}
                      />
                    ))}
                  </div>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </main>
  );
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

function RecommendedProvider({
  provider,
  bookingUrl,
  locale,
}: {
  provider: ProviderSearchItem;
  bookingUrl: string;
  locale: KlyxLocale;
}) {
  const t = (key: KlyxRecommendationsMessageKey) =>
    translateKlyxRecommendations(locale, key);
  const displayName = providerDisplayName(provider, t("providerFallback"));
  const displayedService = providerDisplayedService(provider, locale);

  return (
    <article
      data-testid="klyx-primary-recommendation"
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card"
    >
      <div className="grid lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
        <div className="relative min-h-56 overflow-hidden bg-muted lg:min-h-full">
          {provider.avatarUrl ? (
            <Image
              src={provider.avatarUrl}
              alt={displayName}
              fill
              sizes="(max-width: 1024px) 100vw, 38vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full min-h-56 place-items-center">
              <UserRound size={54} className="text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
            {t("bestChoice")}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {displayName}
            </h2>
            {provider.isVerified && (
              <BadgeCheck
                size={19}
                className="shrink-0 text-blue-600 dark:text-blue-400"
                aria-label={t("verified")}
              />
            )}
          </div>

          <p className="mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
            {displayedService}
          </p>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            {provider.headline || t("headlineFallback")}
          </p>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-semibold">{t("whyRecommended")}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <RecommendationReason
                icon={<ShieldCheck size={16} />}
                label={formatKlyxRecommendationScore(locale, provider.klyxScore)}
              />
              <RecommendationReason
                icon={<Star size={16} />}
                label={formatKlyxRecommendationExperience(
                  locale,
                  provider.yearsExperience
                )}
              />
              <RecommendationReason
                icon={<CheckCircle2 size={16} />}
                label={formatKlyxRecommendationMissions(
                  locale,
                  provider.completedJobs
                )}
              />
              <RecommendationReason
                icon={<MapPin size={16} />}
                label={provider.city || t("areaToConfirm")}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-1 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
            <div>
              <p className="text-xl font-semibold">
                {formatKlyxRecommendationPrice(
                  locale,
                  provider.price,
                  provider.pricingType
                )}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {provider.availabilitySummary || t("availabilityFallback")}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link
              href={profileHref(provider)}
              className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              {t("viewProfile")}
            </Link>
            <Link
              href={bookingUrl}
              className="klyx-button inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold"
            >
              {t("chooseRecommendation")}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function RecommendationReason({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-blue-600 dark:text-blue-400">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function AlternativeProviderRow({
  provider,
  bookingUrl,
  locale,
}: {
  provider: ProviderSearchItem;
  bookingUrl: string;
  locale: KlyxLocale;
}) {
  const t = (key: KlyxRecommendationsMessageKey) =>
    translateKlyxRecommendations(locale, key);
  const displayName = providerDisplayName(provider, t("providerFallback"));
  const displayedService = providerDisplayedService(provider, locale);

  return (
    <article className="flex flex-col gap-4 border-b border-border py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
          {provider.avatarUrl ? (
            <Image
              src={provider.avatarUrl}
              alt={displayName}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <UserRound size={18} className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{displayName}</h3>
            {provider.isVerified && (
              <BadgeCheck
                size={15}
                className="shrink-0 text-blue-600 dark:text-blue-400"
                aria-label={t("verified")}
              />
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {displayedService} · {provider.city || t("areaToConfirm")} ·{" "}
            {formatKlyxRecommendationPrice(
              locale,
              provider.price,
              provider.pricingType
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        <Link
          href={profileHref(provider)}
          className="inline-flex min-h-10 items-center justify-center px-3 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          {t("viewProfile")}
        </Link>
        <Link
          href={bookingUrl}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted"
        >
          {t("choose")}
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto grid min-h-56 max-w-5xl place-items-center border-y border-border">
            <LoaderCircle className="animate-spin text-blue-600" />
          </div>
        </main>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}
