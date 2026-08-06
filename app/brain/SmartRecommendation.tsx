"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  formatProviderPrice,
  scoreLabel,
  type ProviderSearchItem,
} from "@/lib/provider-search";

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed: boolean;
  ready: boolean;
};

type RecommendationResult = {
  provider: ProviderSearchItem | null;
  alternativesCount: number;
  showingAlternative: boolean;
  profileUrl?: string;
  bookingUrl?: string;
  error?: string;
};

export default function SmartRecommendation({
  payload,
}: {
  payload: BrainPayload;
}) {
  const [result, setResult] =
    useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function recommend() {
      setLoading(true);
      setErrorMessage("");
      setResult(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "Session manquante. Reconnecte-toi."
          );
        }

        const response = await fetch(
          "/api/brain/recommend",
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              serviceSlug: payload.serviceSlug,
              city: payload.city,
              date: payload.date,
              time: payload.time,
              budget: payload.budget,
              durationHours: 1,
            }),
          }
        );

        const body =
          (await response.json()) as RecommendationResult;

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Impossible de préparer la réservation."
          );
        }

        setResult(body);
      } catch (error) {
        if (controller.signal.aborted) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de préparer la réservation."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void recommend();

    return () => controller.abort();
  }, [
    payload.serviceSlug,
    payload.city,
    payload.date,
    payload.time,
    payload.budget,
  ]);

  if (loading) {
    return (
      <section className="border-t border-border bg-violet-500/[0.04] p-5">
        <div className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-background p-4">
          <LoaderCircle
            className="animate-spin text-violet-600"
            size={20}
          />
          <div>
            <p className="text-sm font-black">
              KLYX cherche le meilleur profil
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Disponibilité, prix, score et expérience.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="border-t border-border bg-violet-500/[0.04] p-5">
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      </section>
    );
  }

  if (!result?.provider) {
    const params = new URLSearchParams();

    if (payload.serviceSlug) {
      params.set("service", payload.serviceSlug);
    }
    if (payload.city) params.set("city", payload.city);
    if (payload.date) params.set("date", payload.date);
    if (payload.time) params.set("time", payload.time);
    if (payload.budget !== null) {
      params.set("budget", String(payload.budget));
    }

    return (
      <section className="border-t border-border bg-violet-500/[0.04] p-5">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <p className="font-black">
            Aucun profil disponible exactement maintenant
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Modifie un critère ou consulte toute la recherche.
          </p>
          <Link
            href={`/search?${params.toString()}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400"
          >
            Ouvrir la recherche
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  }

  const provider = result.provider;
  const displayName =
    provider.businessName ||
    `${provider.firstName} ${provider.lastName}`.trim() ||
    "Prestataire KLYX";

  return (
    <section className="border-t border-border bg-violet-500/[0.04] p-5">
      <div className="overflow-hidden rounded-[1.75rem] border border-violet-500/25 bg-background shadow-[0_16px_45px_rgba(124,58,237,0.12)]">
        <div className="flex items-center gap-2 border-b border-border bg-violet-500/10 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-violet-700 dark:text-violet-300">
          <Sparkles size={15} />
          Proposition préparée par KLYX
        </div>

        <div className="p-5">
          {result.showingAlternative && (
            <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              Aucun profil ne correspond à tous les critères.
              Voici l’alternative la plus proche.
            </p>
          )}

          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-violet-500/10 text-violet-600">
              {provider.avatarUrl ? (
                <img
                  src={provider.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={25} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-black">
                  {displayName}
                </h3>
                {provider.isVerified && (
                  <BadgeCheck
                    size={18}
                    className="text-violet-600"
                  />
                )}
              </div>

              <p className="mt-1 text-sm font-bold text-violet-600 dark:text-violet-400">
                {provider.title || provider.serviceLabel}
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {formatProviderPrice(
                  provider.price,
                  provider.pricingType
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-center">
              <p className="font-black text-emerald-700 dark:text-emerald-300">
                {provider.klyxScore}
              </p>
              <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                Score
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Info
              icon={<ShieldCheck size={15} />}
              text={scoreLabel(provider.klyxScore)}
            />
            <Info
              icon={<CheckCircle2 size={15} />}
              text={`${provider.completedJobs} mission${
                provider.completedJobs > 1 ? "s" : ""
              }`}
            />
            <Info
              icon={<MapPin size={15} />}
              text={provider.city || "Zone à confirmer"}
            />
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Star size={15} />
            {provider.availabilitySummary}
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            KLYX ne réserve et ne paie jamais sans ton
            confirmation finale.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href={result.profileUrl || "#"}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-border px-4 text-sm font-black transition hover:bg-muted"
            >
              Vérifier le profil
            </Link>

            <Link
              href={result.bookingUrl || "#"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500"
            >
              Préparer la réservation
              <ArrowRight size={16} />
            </Link>
          </div>

          {result.alternativesCount > 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {result.alternativesCount} autre
              {result.alternativesCount > 1 ? "s" : ""} profil
              {result.alternativesCount > 1 ? "s" : ""} disponible
              {result.alternativesCount > 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Info({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-bold">
      <span className="text-violet-600">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}
