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
import {
  formatProviderPrice,
  scoreLabel,
  serviceLabel,
  type ProviderSearchItem,
  type ProviderSearchResponse,
} from "@/lib/provider-search";

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
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const stableParams = useMemo(
    () => new URLSearchParams(queryString),
    [queryString]
  );

  const [result, setResult] =
    useState<ProviderSearchResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      setErrorMessage("");

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
          throw new Error(body.error || "Recherche impossible.");
        }

        setResult(body);
      } catch (error) {
        if (controller.signal.aborted) return;

        setResult(EMPTY_RESPONSE);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les recommandations."
        );
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
          Modifier ma demande
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />

          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              <Sparkles size={15} />
              Sélection KLYX
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              Les meilleurs profils pour ta demande
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              KLYX classe les profils selon la correspondance avec tes critères,
              leur score de confiance, leur expérience et leur disponibilité.
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary
            icon={<Search size={17} />}
            label="Service"
            value={service ? serviceLabel(service, service) : "Tous"}
          />
          <Summary
            icon={<MapPin size={17} />}
            label="Ville"
            value={city || "Toutes les zones"}
          />
          <Summary
            icon={<CalendarDays size={17} />}
            label="Date"
            value={date || "Flexible"}
          />
          <Summary
            icon={<Clock3 size={17} />}
            label="Heure"
            value={time || "Flexible"}
          />
          <Summary
            icon={<Euro size={17} />}
            label="Budget"
            value={budget ? `${budget} € maximum` : "Non défini"}
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
                KLYX compare les profils disponibles...
              </p>
            </div>
          </section>
        )}

        {!loading && errorMessage && (
          <section className="mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black">Sélection indisponible</p>
                <p className="mt-2 text-sm">{errorMessage}</p>
              </div>
            </div>
          </section>
        )}

        {!loading &&
          !errorMessage &&
          result.showingAlternatives &&
          topProviders.length > 0 && (
            <section className="mt-8 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5 text-amber-800 dark:text-amber-200">
              <p className="font-black">
                Aucun profil ne correspond exactement à tous les critères.
              </p>
              <p className="mt-2 text-sm leading-6">
                KLYX affiche les alternatives les plus proches pour ne pas te
                laisser sans solution.
              </p>
            </section>
          )}

        {!loading && !errorMessage && topProviders.length === 0 && (
          <section className="klyx-card mt-8 p-8 text-center sm:p-12">
            <UserRound
              size={42}
              className="mx-auto text-muted-foreground"
            />
            <h2 className="mt-5 text-2xl font-black">
              Aucun prestataire disponible
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              Aucun profil publié ne correspond encore à cette demande. Essaie
              une autre zone, une autre date ou un budget plus flexible.
            </p>

            <Link
              href={`/search?${queryString}`}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white"
            >
              Modifier les filtres
              <ArrowRight size={17} />
            </Link>
          </section>
        )}

        {!loading && !errorMessage && topProviders.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="klyx-eyebrow">Recommandations</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                  {topProviders.length} profil
                  {topProviders.length > 1 ? "s" : ""} sélectionné
                  {topProviders.length > 1 ? "s" : ""}
                </h2>
              </div>

              <Link
                href={`/search?${queryString}`}
                className="inline-flex items-center gap-2 text-sm font-bold text-violet-600 dark:text-violet-400"
              >
                Voir tous les résultats
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
}: {
  provider: ProviderSearchItem;
  position: number;
  bookingUrl: string;
}) {
  const displayName =
    provider.businessName ||
    `${provider.firstName} ${provider.lastName}`.trim() ||
    "Prestataire KLYX";

  return (
    <article className="klyx-card klyx-card-hover group relative flex min-h-[32rem] flex-col overflow-hidden p-0">
      {position === 1 && (
        <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-background/90 dark:bg-zinc-950/90 px-3 py-1.5 text-xs font-black text-foreground dark:text-white shadow-lg backdrop-blur">
          <Medal size={15} className="text-amber-400" />
          Meilleur choix
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
          {formatProviderPrice(provider.price, provider.pricingType)}
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
              {provider.title || provider.serviceLabel}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              {provider.klyxScore}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700/70 dark:text-emerald-300/70">
              Score
            </p>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {provider.headline ||
            "Prestataire disponible pour répondre à ta demande."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <TrustItem
            icon={<ShieldCheck size={16} />}
            label={scoreLabel(provider.klyxScore)}
          />
          <TrustItem
            icon={<Star size={16} />}
            label={`${provider.yearsExperience} an${
              provider.yearsExperience > 1 ? "s" : ""
            } d’expérience`}
          />
          <TrustItem
            icon={<CheckCircle2 size={16} />}
            label={`${provider.completedJobs} mission${
              provider.completedJobs > 1 ? "s" : ""
            }`}
          />
          <TrustItem
            icon={<MapPin size={16} />}
            label={provider.city || "Zone à confirmer"}
          />
        </div>

        <p className="mt-5 text-xs font-semibold text-muted-foreground">
          {provider.availabilitySummary ||
            "Disponibilité à confirmer avec le prestataire."}
        </p>

        <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-2">
          <Link
            href={profileHref(provider)}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-4 text-sm font-bold transition hover:bg-muted"
          >
            Voir le profil
          </Link>

          <Link
            href={bookingUrl}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500"
          >
            Choisir
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
