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
import { useEffect, useMemo, useState } from "react";

type WindowDays = 7 | 30 | 90;

type AnalyticsResponse = {
  window: {
    days: number;
    startDate: string;
    endDate: string;
  };
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
  privacy: {
    aggregateOnly: boolean;
    storesUserIdentifiers: boolean;
    storesSearchText: boolean;
    storesLocation: boolean;
    storesIpAddress: boolean;
    note: string;
  };
  interpretation: string;
  error?: string;
};

const WINDOWS: WindowDays[] = [7, 30, 90];

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${value.toLocaleString("fr-BE")}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-BE", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function FounderAnalyticsPage() {
  const [days, setDays] = useState<WindowDays>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/founder/analytics?days=${days}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as AnalyticsResponse;

        if (!response.ok) {
          throw new Error(body.error || "Analytics Founder indisponibles.");
        }

        setData(body);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Analytics Founder indisponibles."
        );
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
          <ArrowLeft size={16} /> Console Founder
        </Link>

        <section className="mt-5 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-7 text-white sm:p-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} /> Analytics privées
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-4xl">
            Funnel produit KLYX
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Volumes produit utiles au lancement, sans tracker navigateur et sans
            conserver les recherches, villes, IP ou identifiants des utilisateurs.
          </p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2" aria-label="Fenêtre analytics">
          {WINDOWS.map((windowDays) => (
            <button
              key={windowDays}
              type="button"
              onClick={() => setDays(windowDays)}
              aria-pressed={days === windowDays}
              className={`min-h-11 rounded-xl px-4 text-sm font-black ${
                days === windowDays
                  ? "bg-violet-600 text-white"
                  : "border border-border bg-card"
              }`}
            >
              {windowDays} jours
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-8 flex min-h-48 items-center justify-center rounded-3xl border border-border bg-card">
            <LoaderCircle className="animate-spin" size={32} aria-label="Chargement" />
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<UserPlus size={20} />}
                label="Nouveaux profils clients"
                value={data.metrics.newClientProfiles}
              />
              <MetricCard
                icon={<Search size={20} />}
                label="Recherches prestataires"
                value={data.metrics.searches}
                detail={`${data.metrics.searchesWithResults} avec résultat`}
              />
              <MetricCard
                icon={<FileText size={20} />}
                label="Demandes de devis"
                value={data.metrics.quotesRequested}
                detail={`${data.metrics.quotesAccepted} acceptées sur la période`}
              />
              <MetricCard
                icon={<CalendarCheck2 size={20} />}
                label="Réservations créées"
                value={data.metrics.bookingsCreated}
                detail={`${data.metrics.completedBookings} terminées`}
              />
              <MetricCard
                icon={<CreditCard size={20} />}
                label="Réservations payées"
                value={data.metrics.paidBookings}
              />
              <MetricCard
                icon={<CheckCircle2 size={20} />}
                label="Recherches avec résultat"
                value={formatPercent(data.ratios.searchResultRate)}
              />
              <MetricCard
                icon={<FileText size={20} />}
                label="Devis / recherches"
                value={formatPercent(data.ratios.quotePerSearchVolume)}
              />
              <MetricCard
                icon={<CreditCard size={20} />}
                label="Payées / réservations"
                value={formatPercent(data.ratios.paidPerBookingVolume)}
              />
            </section>

            <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Recherches quotidiennes</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.window.startDate} → {data.window.endDate}
                  </p>
                </div>
                <p className="text-xs font-bold text-muted-foreground">
                  Hauteur = volume quotidien
                </p>
              </div>

              <div
                className="mt-7 flex min-h-48 items-end gap-1 overflow-x-auto pb-2"
                aria-label="Volumes de recherche quotidiens"
              >
                {data.dailySearches.map((item) => {
                  const height = Math.max(
                    item.searches > 0 ? 8 : 2,
                    Math.round((item.searches / maximumSearches) * 160)
                  );
                  const successShare =
                    item.searches > 0
                      ? Math.round((item.withResults / item.searches) * 100)
                      : 0;

                  return (
                    <div
                      key={item.date}
                      className="flex min-w-5 flex-1 flex-col items-center justify-end gap-2"
                      title={`${formatDate(item.date)} : ${item.searches} recherche(s), ${successShare}% avec résultat`}
                    >
                      <div
                        className="w-full rounded-t-md bg-violet-600/80"
                        style={{ height }}
                        aria-hidden="true"
                      />
                      {data.window.days <= 7 && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(item.date)}
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
                <h2 className="mt-4 text-lg font-black">Privacy by design</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {data.privacy.note}
                </p>
                <ul className="mt-4 space-y-2 text-sm font-bold">
                  <li>Aucun identifiant utilisateur dans les compteurs de recherche.</li>
                  <li>Aucun texte recherché ni ville conservés.</li>
                  <li>Aucune adresse IP ni identifiant navigateur conservés.</li>
                </ul>
              </article>

              <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-black">Lecture correcte des ratios</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {data.interpretation}
                </p>
                <div className="mt-5 rounded-2xl bg-muted/50 p-4 text-sm">
                  Réservations / devis :{" "}
                  <strong>{formatPercent(data.ratios.bookingPerQuoteVolume)}</strong>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="text-violet-600">{icon}</div>
      <p className="mt-4 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black">
        {typeof value === "number" ? value.toLocaleString("fr-BE") : value}
      </p>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </article>
  );
}
