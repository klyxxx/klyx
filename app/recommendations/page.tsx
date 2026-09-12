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
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import type { KlyxLocale } from "@/lib/klyx-i18n";
import {
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
// KLYX_RECOMMENDATIONS_CONVERSATIONAL_RESULT_20260911

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

function RecommendationOption({
  provider,
  bookingUrl,
  locale,
  primary = false,
}: {
  provider: ProviderSearchItem;
  bookingUrl: string;
  locale: KlyxLocale;
  primary?: boolean;
}) {
  const t = (key: KlyxRecommendationsMessageKey) =>
    translateKlyxRecommendations(locale, key);
  const displayName = providerDisplayName(provider, t("providerFallback"));

  return (
    <article
      data-testid={primary ? "klyx-primary-recommendation" : undefined}
      className="py-5 first:pt-0 last:pb-0"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
          <UserRound size={17} className="text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold sm:text-lg">{displayName}</h2>
            {provider.isVerified && (
              <BadgeCheck
                size={16}
                className="shrink-0 text-blue-600 dark:text-blue-400"
                aria-label={t("verified")}
              />
            )}
            {primary && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {t("bestChoice")}
              </span>
            )}
          </div>

          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">{t("whyRecommended")}: </span>
              <span className="font-medium">
                {formatKlyxRecommendationMissions(locale, provider.completedJobs)}
              </span>
            </p>
            <p className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-blue-600 dark:text-blue-400" />
              <span className="font-medium">
                {formatKlyxRecommendationScore(locale, provider.klyxScore)}
              </span>
            </p>
            <p className="font-medium">
              {formatKlyxRecommendationPrice(
                locale,
                provider.price,
                provider.pricingType
              )}
            </p>
          </div>

          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400" />
            {provider.availabilitySummary || t("availabilityFallback")}
          </p>

          <div className="mt-4">
            <Link
              href={bookingUrl}
              className="klyx-button inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold"
            >
              {primary ? t("chooseRecommendation") : t("choose")}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </article>
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

        <div className="mt-8 space-y-7">
          <section className="flex justify-end" aria-label={t("requestSummary")}>
            <div
              data-testid="klyx-request-summary"
              className="max-w-[88%] rounded-3xl bg-muted px-4 py-3 text-sm sm:max-w-[72%]"
            >
              <p className="font-semibold text-foreground">{displayedService}</p>
              <p className="mt-1 leading-6 text-muted-foreground">
                {[city, date, time, budget ? `${budget} € ${t("budgetMaximum")}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </section>

          <section className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
              K
            </div>
            <div className="min-w-0 flex-1">
              <p className="max-w-2xl text-sm leading-7 sm:text-base">
                {t("description")}
              </p>

              {result.showingAlternatives && !loading && !loadError && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t("alternativesDescription")}
                </p>
              )}

              {loading && (
                <div className="mt-6 flex items-center gap-3 py-4 text-sm text-muted-foreground">
                  <LoaderCircle size={19} className="animate-spin text-blue-600" />
                  {t("loading")}
                </div>
              )}

              {!loading && loadError && (
                <div className="mt-6 flex gap-3 border-l-2 border-red-500/40 pl-4 text-red-700 dark:text-red-300">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="font-semibold">{t("selectionUnavailable")}</p>
                    <p className="mt-1 text-sm">{t("loadError")}</p>
                  </div>
                </div>
              )}

              {!loading && !loadError && topProviders.length === 0 && (
                <div className="mt-6 border-t border-border pt-5">
                  <p className="font-semibold">{t("noProviderTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t("noProviderDescription")}
                  </p>
                  <Link
                    href={`/request/confirm?${queryString}`}
                    className="klyx-button mt-4 inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold"
                  >
                    {t("editRequest")}
                    <ArrowRight size={15} />
                  </Link>
                </div>
              )}

              {!loading && !loadError && topProviders.length > 0 && (
                <div className="mt-6 divide-y divide-border border-y border-border py-5">
                  <RecommendationOption
                    provider={topProviders[0]}
                    bookingUrl={bookingHref(topProviders[0], stableParams)}
                    locale={locale}
                    primary
                  />
                  {topProviders.length > 1 && (
                    <div data-testid="klyx-secondary-options">
                      {topProviders.slice(1).map((provider) => (
                        <RecommendationOption
                          key={provider.userServiceId}
                          provider={provider}
                          bookingUrl={bookingHref(provider, stableParams)}
                          locale={locale}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto grid min-h-56 max-w-3xl place-items-center">
            <LoaderCircle className="animate-spin text-blue-600" />
          </div>
        </main>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}
