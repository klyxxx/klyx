"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "client" | "provider";

type Quote = {
  id: string;
  status: string;
};

type ActionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  count?: number;
  icon:
    | typeof FileText
    | typeof FileCheck2
    | typeof Clock3;
  important?: boolean;
};

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function DashboardActionCenter({
  accountType,
}: {
  accountType: AccountType;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await accessToken();

        const response = await fetch("/api/quotes", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = (await response.json()) as {
          quotes?: Quote[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Impossible de charger les actions."
          );
        }

        if (!cancelled) {
          setQuotes(
            Array.isArray(body.quotes)
              ? body.quotes
              : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger les actions."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [accountType]);

  const actions = useMemo<ActionItem[]>(() => {
    const count = (status: string) =>
      quotes.filter(
        (quote) => quote.status === status
      ).length;

    if (accountType === "provider") {
      const requested = count("requested");
      const sent = count("sent");

      const result: ActionItem[] = [];

      if (requested > 0) {
        result.push({
          id: "provider-quotes-requested",
          title: "Demandes de devis à traiter",
          description:
            "Des clients attendent ton prix. Répondre rapidement améliore ton expérience professionnelle.",
          href: "/provider/quotes",
          count: requested,
          icon: FileText,
          important: true,
        });
      }

      if (sent > 0) {
        result.push({
          id: "provider-quotes-sent",
          title: "Devis envoyés en attente",
          description:
            "Ces devis ont été envoyés et attendent encore la décision du client.",
          href: "/provider/quotes",
          count: sent,
          icon: Clock3,
        });
      }

      return result;
    }

    const sent = count("sent");
    const accepted = count("accepted");
    const requested = count("requested");

    const result: ActionItem[] = [];

    if (sent > 0) {
      result.push({
        id: "client-quotes-sent",
        title: "Devis à examiner",
        description:
          "Un prestataire a confirmé son prix. Vérifie le montant avant d’accepter ou refuser.",
        href: "/quotes",
        count: sent,
        icon: FileCheck2,
        important: true,
      });
    }

    if (accepted > 0) {
      result.push({
        id: "client-quotes-accepted",
        title: "Réservations à préparer",
        description:
          "Tu as accepté un devis. Vérifie maintenant le créneau avant d’envoyer la demande de réservation.",
        href: "/quotes",
        count: accepted,
        icon: FileText,
        important: true,
      });
    }

    if (
      requested > 0 &&
      result.length < 3
    ) {
      result.push({
        id: "client-quotes-requested",
        title: "Devis en attente",
        description:
          "Tes demandes ont bien été envoyées. Les prestataires doivent encore répondre.",
        href: "/quotes",
        count: requested,
        icon: Clock3,
      });
    }

    return result;
  }, [accountType, quotes]);

  const provider =
    accountType === "provider";

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className={
              provider
                ? "text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400"
                : "klyx-eyebrow"
            }
          >
            À faire maintenant
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {provider
              ? "Priorités de ton activité"
              : "Tes prochaines actions"}
          </h2>
        </div>

        {!loading && actions.length > 0 && (
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
            {actions.length} priorité
            {actions.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="klyx-card mt-5 flex min-h-28 items-center gap-4 p-5">
          <span
            className={`grid h-11 w-11 place-items-center rounded-2xl ${
              provider
                ? "bg-blue-500/10 text-blue-600"
                : "bg-violet-500/10 text-violet-600"
            }`}
          >
            <LoaderCircle
              className="animate-spin"
              size={20}
            />
          </span>

          <div>
            <p className="font-black">
              KLYX vérifie tes priorités
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Le reste du dashboard reste utilisable pendant le chargement.
            </p>
          </div>
        </div>
      ) : errorMessage ? (
        <div className="klyx-card mt-5 p-5">
          <p className="text-sm text-muted-foreground">
            Le centre d’actions n’a pas pu être
            actualisé. Tes autres fonctions KLYX
            restent disponibles.
          </p>
        </div>
      ) : actions.length === 0 ? (
        <div className="klyx-card mt-5 flex items-start gap-4 p-5 sm:p-6">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
              provider
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
            }`}
          >
            <CheckCircle2 size={22} />
          </span>

          <div>
            <h3 className="font-black">
              Rien d’urgent pour le moment
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {provider
                ? "Tes demandes de devis ne nécessitent actuellement aucune action immédiate."
                : "Tes devis ne nécessitent actuellement aucune action immédiate."}
            </p>

            <Link
              href={
                provider
                  ? "/provider"
                  : "/brain"
              }
              className={`mt-4 inline-flex items-center gap-2 text-sm font-black ${
                provider
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-violet-600 dark:text-violet-400"
              }`}
            >
              {provider
                ? "Ouvrir mon activité"
                : "Parler à KLYX"}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {actions.slice(0, 3).map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.id}
                href={action.href}
                prefetch
                className={`klyx-card klyx-card-hover group relative flex min-h-48 flex-col overflow-hidden p-5 sm:p-6 ${
                  action.important
                    ? provider
                      ? "border-blue-500/30 bg-blue-500/[0.045]"
                      : "border-violet-500/30 bg-violet-500/[0.045]"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl ${
                      provider
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    <Icon size={20} />
                  </span>

                  {typeof action.count ===
                    "number" && (
                    <span
                      className={`grid min-h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-black ${
                        provider
                          ? "bg-blue-600 text-white"
                          : "bg-violet-600 text-white"
                      }`}
                    >
                      {action.count}
                    </span>
                  )}
                </div>

                <h3 className="mt-5 text-lg font-black">
                  {action.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {action.description}
                </p>

                <span
                  className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${
                    provider
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-violet-600 dark:text-violet-400"
                  }`}
                >
                  Ouvrir
                  <ArrowRight
                    size={16}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!provider && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles
            size={14}
            className="text-violet-500"
          />
          KLYX affiche seulement les étapes qui correspondent au profil client actif.
        </div>
      )}
    </section>
  );
}
