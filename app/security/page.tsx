"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Signal = {
  code: string;
  label: string;
  points: number;
  detail: string;
};

type Recommendation = {
  code: string;
  label: string;
  detail: string;
};

type Alert = {
  id: string;
  severity: string;
  title: string;
  description: string;
  created_at: string;
};

type SecurityResponse = {
  assessment?: {
    score: number;
    level: "low" | "moderate" | "high" | "critical";
    signals: Signal[];
    recommendations: Recommendation[];
  };
  alerts?: Alert[];
  automaticRestriction?: boolean;
  explanation?: string;
  error?: string;
};

const LEVELS = {
  low: {
    label: "Faible",
    text: "Aucun signal important détecté.",
  },
  moderate: {
    label: "Modéré",
    text: "Quelques éléments méritent ton attention.",
  },
  high: {
    label: "Élevé",
    text: "Plusieurs signaux doivent être corrigés.",
  },
  critical: {
    label: "Prioritaire",
    text: "Un examen de sécurité est nécessaire.",
  },
} as const;

export default function SecurityPage() {
  const [result, setResult] =
    useState<SecurityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session manquante.");
      }

      const response = await fetch(
        "/api/security/risk",
        {
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const body =
        (await response.json()) as SecurityResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Analyse impossible."
        );
      }

      setResult(body);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger le Bouclier KLYX."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const assessment = result?.assessment;
  const level = assessment
    ? LEVELS[assessment.level]
    : null;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#101827,#19324d_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <ShieldCheck size={15} />
            Bouclier KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Sécurité du profil
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
            KLYX analyse les annulations, litiges, paiements
            et vérifications pour expliquer les risques.
          </p>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
          >
            <RefreshCw size={17} />
            Actualiser l’analyse
          </button>
        </section>

        {loading && (
          <div className="mt-8 grid min-h-52 place-items-center">
            <LoaderCircle
              className="animate-spin text-blue-600"
              size={38}
            />
          </div>
        )}

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {!loading && assessment && level && (
          <>
            <section className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <article className="klyx-card p-7">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <Gauge size={24} />
                  <p className="font-black">
                    Indicateur de risque
                  </p>
                </div>

                <p className="mt-6 text-6xl font-black">
                  {assessment.score}
                  <span className="text-xl text-muted-foreground">
                    /100
                  </span>
                </p>

                <p className="mt-3 text-xl font-black">
                  Niveau {level.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {level.text}
                </p>
              </article>

              <article className="klyx-card p-7">
                <h2 className="text-2xl font-black">
                  Analyse transparente
                </h2>

                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {result.explanation}
                </p>

                <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                  Aucune suspension définitive automatique.
                  Les signaux servent à prévenir et à guider.
                </div>

                <Link
                  href="/trust"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400"
                >
                  Ouvrir le Centre de confiance
                  <ArrowRight size={16} />
                </Link>
              </article>
            </section>

            <section className="mt-8">
              <p className="klyx-eyebrow">
                Signaux détectés
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Pourquoi ce niveau ?
              </h2>

              {assessment.signals.length === 0 ? (
                <div className="klyx-card mt-5 p-7">
                  <CheckCircle2
                    className="text-emerald-500"
                    size={38}
                  />
                  <h3 className="mt-4 text-xl font-black">
                    Aucun signal négatif
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Continue à utiliser KLYX de manière fiable.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {assessment.signals.map((signal) => (
                    <article
                      key={signal.code}
                      className="klyx-card p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-black">
                            {signal.label}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {signal.detail}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            signal.points <= 0
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {signal.points > 0 ? "+" : ""}
                          {signal.points}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <p className="klyx-eyebrow">
                Amélioration
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Recommandations KLYX
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {assessment.recommendations.map(
                  (recommendation) => (
                    <article
                      key={recommendation.code}
                      className="klyx-card p-5"
                    >
                      <ShieldCheck
                        className="text-blue-600"
                        size={22}
                      />
                      <h3 className="mt-4 font-black">
                        {recommendation.label}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {recommendation.detail}
                      </p>
                    </article>
                  )
                )}
              </div>
            </section>

            {(result.alerts?.length ?? 0) > 0 && (
              <section className="mt-8">
                <p className="klyx-eyebrow">
                  Alertes actives
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Points d’attention
                </h2>

                <div className="mt-5 grid gap-4">
                  {result.alerts?.map((alert) => (
                    <article
                      key={alert.id}
                      className="klyx-card flex gap-4 p-5"
                    >
                      <AlertTriangle className="shrink-0 text-amber-500" />
                      <div>
                        <h3 className="font-black">
                          {alert.title}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {alert.description}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
