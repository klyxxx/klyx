"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActionKind =
  | "compare_offers"
  | "finalize_booking"
  | "payment_pending"
  | "review_completed"
  | "provider_offer_update"
  | string;

type ActionItem = {
  id: string;
  kind: ActionKind;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type ActionsResponse = {
  accountType: "client" | "provider";
  actions: ActionItem[];
  count: number;
};

function explanation(kind: ActionKind): {
  why: string;
  confirmation: string;
} {
  switch (kind) {
    case "compare_offers":
      return {
        why:
          "Des prestataires ont répondu. Comparer maintenant évite de choisir uniquement sur le prix.",
        confirmation:
          "KLYX peut analyser et recommander, mais ne choisit aucun prestataire sans ta confirmation.",
      };

    case "finalize_booking":
      return {
        why:
          "Le prestataire et le prix sont déjà choisis. Le créneau reste nécessaire pour créer la réservation.",
        confirmation:
          "La réservation n’est créée qu’après ta validation du créneau.",
      };

    case "payment_pending":
      return {
        why:
          "La réservation existe déjà. Le paiement est la prochaine étape avant l’exécution de la mission.",
        confirmation:
          "KLYX ne déclenche jamais un paiement sans action explicite de ta part.",
      };

    case "review_completed":
      return {
        why:
          "La mission est terminée. Ton avis améliore la confiance et le classement des prestataires.",
        confirmation:
          "L’avis reste entièrement rédigé et envoyé par toi.",
      };

    case "provider_offer_update":
      return {
        why:
          "Une de tes offres a été acceptée. Il faut vérifier la réservation et préparer la mission.",
        confirmation:
          "KLYX peut te guider, mais aucune action contractuelle n’est exécutée automatiquement.",
      };

    default:
      return {
        why:
          "KLYX a détecté cette action comme pertinente pour la suite de ton parcours.",
        confirmation:
          "Tu gardes toujours le contrôle des actions importantes.",
      };
  }
}

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function ProactiveAssistantPanel() {
  const [data, setData] = useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await accessToken();

      const response = await fetch("/api/brain/actions", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await response.json()) as
        | ActionsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in body
            ? body.error || "Impossible de charger les priorités."
            : "Impossible de charger les priorités."
        );
      }

      setData(body as ActionsResponse);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les priorités."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [load]);

  const topActions = useMemo(
    () => (data?.actions ?? []).slice(0, 3),
    [data]
  );

  if (loading) {
    return (
      <section className="klyx-card mt-6 p-6">
        <div className="flex items-center gap-3 text-sm font-black text-muted-foreground">
          <LoaderCircle className="animate-spin" size={18} />
          KLYX analyse ce qui mérite ton attention...
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
        {errorMessage}
      </section>
    );
  }

  if (topActions.length === 0) {
    return (
      <section className="klyx-card mt-6 border-emerald-500/20 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <p className="klyx-eyebrow">Assistant proactif</p>
            <h2 className="mt-1 text-xl font-black">
              Rien d’important à faire maintenant
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              KLYX continue de surveiller tes prochaines étapes et fera remonter une action dès qu’elle devient utile.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">Assistant proactif</p>
          <h2 className="mt-1 text-2xl font-black">
            KLYX te dit quoi faire ensuite
          </h2>
        </div>

        <Link
          href="/assistant/actions"
          className="text-sm font-black text-violet-600 hover:underline"
        >
          Tout voir
        </Link>
      </div>

      <div className="mt-4 grid gap-4">
        {topActions.map((action, index) => {
          const info = explanation(action.kind);
          const urgent = action.priority >= 95;

          return (
            <article
              key={action.id}
              className={`klyx-card p-6 ${
                urgent
                  ? "border-rose-500/25"
                  : index === 0
                    ? "border-violet-500/25"
                    : ""
              }`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                        urgent
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                          : "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      }`}
                    >
                      {urgent ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      Priorité {index + 1}
                    </span>

                    <span className="text-xs font-bold text-muted-foreground">
                      Score {action.priority}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-black">
                    {action.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </p>

                  <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Pourquoi maintenant
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {info.why}
                    </p>
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck
                      className="mt-0.5 shrink-0 text-blue-600"
                      size={15}
                    />
                    <span>{info.confirmation}</span>
                  </div>
                </div>

                <Link
                  href={action.href}
                  className="klyx-button shrink-0"
                >
                  {action.label}
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
