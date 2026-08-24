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
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  LoaderCircle,
  MapPin,
  Medal,
  Search,
  ShieldCheck,
  Sparkles,
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
  const time = params.get("time");
  const duration = params.get("duration");

  if (date) bookingParams.set("date", date);
  if (time) bookingParams.set("time", time);
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
  const service = stableParams.get("service");
  const city = stableParams.get("city");
  const date = stableParams.get("date");
  const time = stableParams.get("time");
  const budget = stableParams.get("budget");

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/request/confirm?${queryString}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("editRequest")}
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />

          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              <Sparkles size={15} />
              {t("eyebrow")}
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              {t("title")}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              {t("description")}
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary
            icon={<Search size={17} />}
            label={t("service")}
            value={
              service
                ? formatKlyxRecommendationService(
                    locale,
                    service,
                    serviceLabel(service, service)
                  )
                : t("allServices")
            }
          />
          <Summary
            icon={<MapPin size={17} />}
            label={t("city")}
            value={city || t("allAreas")}
          />
          <Summary
            icon={<CalendarDays size={17} />}
            label={t("date")}
            value={date || t("flexible")}
          />
          <Summary
            icon={<Clock3 size={17} />}
            label={t("time")}
            value={time || t("flexible")}
          />
          <Summary
            icon={<Euro size={17} />}
            label={t("budget")}
            value={
              budget
                ? `${budget} € ${t("budgetMaximum")}`
                : t("budgetUndefined")
            }
          />
        </section>

        {loading && (
          <section className="klyx-card mt-8 grid min-h-64 place-items-center p-8">
            <div className="text-center">
              <LoaderCircle
                size={38}
                className="mx-auto animate-spin text-violet-600"
              />
              <p className="mt-4 text-sm font-semibold text-muted-foreground">
                {t("loading")}
              </p>
            </div>
          </section>
        )}

        {!loading && loadError && (
          <section className="mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black">{t("selectionUnavailable")}</p>
                <p className="mt-2 text-sm">{t("loadError")}</p>
              </div>
            </div>
          </section>
        )}

        {!loading &&
          !loadError &&
          result.showingAlternatives &&
          topProviders.length > 0 && (
            <section className="mt-8 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5 text-amber-800 dark:text-amber-200">
              <p className="font-black">{t("alternativesTitle")}</p>
              <p className="mt-2 text-sm leading-6">
                {t("alternativesDescription")}
              </p>
            </section>
          )}

        {!loading && !loadError && topProviders.length === 0 && (
          <section className="klyx-card mt-8 p-8 text-center sm:p-12">
            <UserRound
              size={42}
              className="mx-auto text-muted-foreground"
            />
            <h2 className="mt-5 text-2xl font-black">
              {t("noProviderTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              {t("noProviderDescription")}
            </p>

            <Link
              href={`/search?${queryString}`}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white"
            >
              {t("editFilters")}
              <ArrowRight size={17} />
            </Link>
          </section>
        )}

        {!loading && !loadError && topProviders.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="klyx-eyebrow">{t("recommendations")}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                  {topProviders.length}{" "}
                  {t(
                    topProviders.length === 1
                      ? "selectedProfile"
                      : "selectedProfiles"
                  )}
                </h2>
              </div>

              <Link
                href={`/search?${queryString}`}
                className="inline-flex items-center gap-2 text-sm font-bold text-violet-600 dark:text-violet-400"
              >
                {t("seeAllResults")}
                <ArrowRight size={16} />
              </Link>
            </div>

            <section className="mt-5 grid gap-5 xl:grid-cols-3">
              {topProviders.map((provider, index) => (
                <ProviderCard
                  key={provider.userServiceId}
                  provider={provider}
                  position={index + 1}
                  bookingUrl={bookingHref(provider, stableParams)}
                  locale={locale}
                />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-black uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-black">{value}</p>
    </article>
  );
}

function ProviderCard({
  provider,
  position,
  bookingUrl,
  locale,
}: {
  provider: ProviderSearchItem;
  position: number;
  bookingUrl: string;
  locale: KlyxLocale;
}) {
  const t = (key: KlyxRecommendationsMessageKey) =>
    translateKlyxRecommendations(locale, key);
  const displayName =
    provider.businessName ||
    `${provider.firstName} ${provider.lastName}`.trim() ||
    t("providerFallback");
  const displayedService =
    provider.title ||
    formatKlyxRecommendationService(
      locale,
      provider.serviceSlug,
      provider.serviceLabel
    );

  return (
    <article className="klyx-card klyx-card-hover group relative flex min-h-[32rem] flex-col overflow-hidden p-0">
      {position === 1 && (
        <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-background/90 dark:bg-zinc-950/90 px-3 py-1.5 text-xs font-black text-foreground dark:text-white shadow-lg backdrop-blur">
          <Medal size={15} className="text-amber-400" />
          {t("bestChoice")}
        </div>
      )}

      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
        {provider.avatarUrl ? (
          <Image
            src={provider.avatarUrl}
            alt={displayName}
            fill
            sizes="(max-width: 1280px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="grid h-24 w-24 place-items-center rounded-full border border-white/20 bg-white/10 text-white">
              <UserRound size={42} />
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />

        <div className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
          {formatKlyxRecommendationPrice(
            locale,
            provider.price,
            provider.pricingType
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black tracking-[-0.03em]">
                {displayName}
              </h3>
              {provider.isVerified && (
                <BadgeCheck
                  size={19}
                  className="shrink-0 text-violet-600 dark:text-violet-400"
                />
              )}
            </div>

            <p className="mt-1 text-sm font-bold text-violet-600 dark:text-violet-400">
              {displayedService}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              {provider.klyxScore}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700/70 dark:text-emerald-300/70">
              {t("score")}
            </p>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {provider.headline || t("headlineFallback")}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <TrustItem
            icon={<ShieldCheck size={16} />}
            label={formatKlyxRecommendationScore(locale, provider.klyxScore)}
          />
          <TrustItem
            icon={<Star size={16} />}
            label={formatKlyxRecommendationExperience(
              locale,
              provider.yearsExperience
            )}
          />
          <TrustItem
            icon={<CheckCircle2 size={16} />}
            label={formatKlyxRecommendationMissions(
              locale,
              provider.completedJobs
            )}
          />
          <TrustItem
            icon={<MapPin size={16} />}
            label={provider.city || t("areaToConfirm")}
          />
        </div>

        <p className="mt-5 text-xs font-semibold text-muted-foreground">
          {provider.availabilitySummary || t("availabilityFallback")}
        </p>

        <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-2">
          <Link
            href={profileHref(provider)}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-4 text-sm font-bold transition hover:bg-muted"
          >
            {t("viewProfile")}
          </Link>

          <Link
            href={bookingUrl}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500"
          >
            {t("choose")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function TrustItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-xs font-bold">
      <span className="text-violet-600 dark:text-violet-400">
        {icon}
      </span>
      <span className="line-clamp-2">{label}</span>
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto grid min-h-64 max-w-7xl place-items-center rounded-3xl border border-border bg-card">
            <LoaderCircle className="animate-spin text-violet-600" />
          </div>
        </main>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}
