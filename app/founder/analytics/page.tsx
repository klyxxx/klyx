"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  FileText,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxFounderAnalyticsDate,
  formatKlyxFounderAnalyticsNumber,
  formatKlyxFounderAnalyticsPercent,
  translateKlyxFounderAnalytics,
  type KlyxFounderAnalyticsMessageKey,
} from "@/lib/klyx-founder-analytics-i18n";
import {
  formatKlyxFounderAnalyticsAccepted,
  formatKlyxFounderAnalyticsCompleted,
  formatKlyxFounderAnalyticsDailyTooltip,
  formatKlyxFounderAnalyticsWithResults,
} from "@/lib/klyx-founder-analytics-format";

// KLYX_FOUNDER_ANALYTICS_I18N

type WindowDays = 7 | 30 | 90;
type AnalyticsResponse = {
  window: { days: number; startDate: string; endDate: string };
  metrics: {
    newClientProfiles: number;
    searches: number;
    searchesWithResults: number;
    searchesWithoutResults: number;
    quotesRequested: number;
    quotesAccepted: number;
    bookingsCreated: number;
    paidBookings: number;
    completedBookings: number;
  };
  ratios: {
    searchResultRate: number | null;
    quotePerSearchVolume: number | null;
    bookingPerQuoteVolume: number | null;
    paidPerBookingVolume: number | null;
  };
  dailySearches: Array<{
    date: string;
    searches: number;
    withResults: number;
    noResults: number;
  }>;
};

const WINDOWS: WindowDays[] = [7, 30, 90];

export default function FounderAnalyticsPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFounderAnalyticsMessageKey) =>
    translateKlyxFounderAnalytics(locale, key);
  const [days, setDays] = useState<WindowDays>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadFailed(false);

      try {
        const response = await fetch(`/api/founder/analytics?days=${days}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as Partial<AnalyticsResponse>;

        if (!response.ok || !body.window || !body.metrics || !body.ratios || !body.dailySearches) {
          setData(null);
          setLoadFailed(true);
          return;
        }

        setData(body as AnalyticsResponse);
      } catch {
        if (controller.signal.aborted) return;
        setData(null);
        setLoadFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [days]);

  const maximumSearches = useMemo(
    () => Math.max(1, ...(data?.dailySearches.map((item) => item.searches) ?? [])),
    [data]
  );

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/founder"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
        >
          <ArrowLeft size={16} /> {t("backFounder")}
        </Link>

        <section className="mt-5 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-7 text-white sm:p-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} /> {t("badge")}
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-4xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2" aria-label={t("windowAria")}>
          {WINDOWS.map((windowDays) => (
            <button
              key={windowDays}
              type="button"
              onClick={() => setDays(windowDays)}
              aria-pressed={days === windowDays}
              className={`min-h-11 rounded-xl px-4 text-sm font-black ${
                days === windowDays ? "bg-violet-600 text-white" : "border border-border bg-card"
              }`}
            >
              {windowDays} {t("days")}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-8 flex min-h-48 items-center justify-center rounded-3xl border border-border bg-card">
            <LoaderCircle className="animate-spin" size={32} aria-label={t("loading")} />
          </div>
        )}

        {!loading && loadFailed && (
          <div className="mt-8 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-700">
            {t("loadError")}
          </div>
        )}

        {!loading && !loadFailed && data && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={<UserPlus size={20} />} label={t("newClients")} value={formatKlyxFounderAnalyticsNumber(locale, data.metrics.newClientProfiles)} />
              <MetricCard icon={<Search size={20} />} label={t("providerSearches")} value={formatKlyxFounderAnalyticsNumber(locale, data.metrics.searches)} detail={formatKlyxFounderAnalyticsWithResults(locale, data.metrics.searchesWithResults)} />
              <MetricCard icon={<FileText size={20} />} label={t("quoteRequests")} value={formatKlyxFounderAnalyticsNumber(locale, data.metrics.quotesRequested)} detail={formatKlyxFounderAnalyticsAccepted(locale, data.metrics.quotesAccepted)} />
              <MetricCard icon={<CalendarCheck2 size={20} />} label={t("bookingsCreated")} value={formatKlyxFounderAnalyticsNumber(locale, data.metrics.bookingsCreated)} detail={formatKlyxFounderAnalyticsCompleted(locale, data.metrics.completedBookings)} />
              <MetricCard icon={<CreditCard size={20} />} label={t("paidBookings")} value={formatKlyxFounderAnalyticsNumber(locale, data.metrics.paidBookings)} />
              <MetricCard icon={<CheckCircle2 size={20} />} label={t("searchesWithResults")} value={formatKlyxFounderAnalyticsPercent(locale, data.ratios.searchResultRate)} />
              <MetricCard icon={<FileText size={20} />} label={t("quotePerSearch")} value={formatKlyxFounderAnalyticsPercent(locale, data.ratios.quotePerSearchVolume)} />
              <MetricCard icon={<CreditCard size={20} />} label={t("paidPerBooking")} value={formatKlyxFounderAnalyticsPercent(locale, data.ratios.paidPerBookingVolume)} />
            </section>

            <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{t("dailySearches")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatKlyxFounderAnalyticsDate(locale, data.window.startDate)} → {formatKlyxFounderAnalyticsDate(locale, data.window.endDate)}
                  </p>
                </div>
                <p className="text-xs font-bold text-muted-foreground">{t("dailyHeight")}</p>
              </div>

              <div className="mt-7 flex min-h-48 items-end gap-1 overflow-x-auto pb-2" aria-label={t("dailyVolumesAria")}>
                {data.dailySearches.map((item) => {
                  const height = Math.max(
                    item.searches > 0 ? 8 : 2,
                    Math.round((item.searches / maximumSearches) * 160)
                  );
                  const successShare = item.searches > 0
                    ? Math.round((item.withResults / item.searches) * 100)
                    : 0;

                  return (
                    <div
                      key={item.date}
                      className="flex min-w-5 flex-1 flex-col items-center justify-end gap-2"
                      title={formatKlyxFounderAnalyticsDailyTooltip(locale, item.date, item.searches, successShare)}
                    >
                      <div className="w-full rounded-t-md bg-violet-600/80" style={{ height }} aria-hidden="true" />
                      {data.window.days <= 7 && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatKlyxFounderAnalyticsDate(locale, item.date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-2">
              <article className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <ShieldCheck className="text-emerald-700" size={24} />
                <h2 className="mt-4 text-lg font-black">{t("privacyTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("privacyDescription")}</p>
                <ul className="mt-4 space-y-2 text-sm font-bold">
                  <li>{t("privacyUserIds")}</li>
                  <li>{t("privacySearchText")}</li>
                  <li>{t("privacyIp")}</li>
                </ul>
              </article>

              <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-black">{t("ratiosTitle")}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("ratiosDescription")}</p>
                <div className="mt-5 rounded-2xl bg-muted/50 p-4 text-sm">
                  {t("bookingPerQuote")}: <strong>{formatKlyxFounderAnalyticsPercent(locale, data.ratios.bookingPerQuoteVolume)}</strong>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ icon, label, value, detail }: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="text-violet-600">{icon}</div>
      <p className="mt-4 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </article>
  );
}
