"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuoteProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type Quote = {
  id: string;
  title: string;
  description: string;
  requested_date: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  pricing_type: "hourly" | "fixed";
  unit_price: number | null;
  quantity: number;
  estimated_total: number | null;
  provider_price: number | null;
  provider_message: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  provider: QuoteProfile | null;
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Demandé",
  sent: "Devis reçu",
  accepted: "Accepté",
  rejected: "Refusé",
  cancelled: "Annulé",
  expired: "Expiré",
};

function name(profile: QuoteProfile | null): string {
  if (!profile) return "Prestataire KLYX";

  return (
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`.trim() || "Prestataire KLYX"
  );
}

function money(value: number | null): string {
  return value == null
    ? "À confirmer"
    : `${Number(value).toFixed(2)} €`;
}

export default function QuotesPage() {
  const [quotes, setQuotes] =
    useState<Quote[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        "/api/quotes",
        {
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

      const body = (await response.json()) as {
        quotes?: Quote[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      setQuotes(body.quotes ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les devis."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(
    quoteId: string,
    action: "accept" | "reject" | "cancel"
  ) {
    setBusyId(quoteId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        "/api/quotes",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            quoteId,
            action,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Action impossible."
        );
      }

      setSuccessMessage(
        body.message || "Devis mis à jour."
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Action impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  const activeCount = useMemo(
    () =>
      quotes.filter((quote) =>
        ["requested", "sent"].includes(
          quote.status
        )
      ).length,
    [quotes]
  );

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <FileText size={15} />
            Espace client
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Mes devis
          </h1>

                    {/* KLYX_AI_FIRST_QUOTES_15_03 */}

          <p className="mt-5 text-sm font-black text-violet-200">
            {activeCount} devis actif
            {activeCount > 1 ? "s" : ""}
          </p>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle
              className="animate-spin text-violet-600"
              size={38}
            />
          </div>
        ) : quotes.length === 0 ? (
          <section className="klyx-card mt-8 p-8 text-center">
            <FileText
              className="mx-auto text-violet-600"
              size={42}
            />
            <h2 className="mt-4 text-xl font-black">
              Aucun devis
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Les demandes de devis apparaîtront ici.
            </p>
          </section>
        ) : (
          <section className="mt-8 grid gap-5">
            {quotes.map((quote) => (
              <article
                key={quote.id}
                className="klyx-card p-6"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="klyx-eyebrow">
                      {STATUS_LABELS[quote.status] ??
                        quote.status}
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      {quote.title}
                    </h2>

                    <p className="mt-2 text-sm font-black text-violet-700 dark:text-violet-300">
                      {name(quote.provider)}
                    </p>

                    <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {quote.description}
                    </p>
                  </div>

                  <div className="min-w-44 rounded-2xl border border-border bg-background/70 p-4 text-right">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Estimation KLYX
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {money(
                        quote.estimated_total
                      )}
                    </p>

                    {quote.provider_price != null && (
                      <>
                        <p className="mt-4 text-xs font-black uppercase tracking-wide text-muted-foreground">
                          Prix prestataire
                        </p>
                        <p className="mt-2 text-2xl font-black text-emerald-600">
                          {money(
                            quote.provider_price
                          )}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {quote.requested_date && (
                    <span>
                      Date : {quote.requested_date}
                    </span>
                  )}
                  {quote.requested_time && (
                    <span>
                      Heure : {quote.requested_time.slice(0, 5)}
                    </span>
                  )}
                  {quote.duration_hours && (
                    <span>
                      Durée : {quote.duration_hours} h
                    </span>
                  )}
                </div>

                {quote.provider_message && (
                  <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Message du prestataire
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {quote.provider_message}
                    </p>
                  </div>
                )}

                {quote.status === "sent" && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={busyId === quote.id}
                      onClick={() =>
                        void act(
                          quote.id,
                          "accept"
                        )
                      }
                      className="klyx-button flex-1"
                    >
                      <Check size={18} />
                      Accepter le devis
                    </button>

                    <button
                      type="button"
                      disabled={busyId === quote.id}
                      onClick={() =>
                        void act(
                          quote.id,
                          "reject"
                        )
                      }
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-500/25 px-5 text-sm font-black text-rose-600"
                    >
                      <X size={18} />
                      Refuser
                    </button>
                  </div>
                )}

                {quote.status === "accepted" && (
                  <Link
                    href={`/quotes/${quote.id}/book`}
                    className="klyx-button mt-5 w-full"
                  >
                    Préparer la réservation
                    <ArrowRight size={18} />
                  </Link>
                )}

                {quote.status === "requested" && (
                  <button
                    type="button"
                    disabled={busyId === quote.id}
                    onClick={() =>
                      void act(
                        quote.id,
                        "cancel"
                      )
                    }
                    className="mt-5 inline-flex items-center gap-2 text-sm font-black text-rose-600"
                  >
                    <Trash2 size={16} />
                    Annuler la demande
                  </button>
                )}
              </article>
            ))}
          </section>
        )}

        <p className="mt-6 text-xs font-semibold text-muted-foreground">
          Accepter un devis ≠ réserver ou payer.
        </p>
      </div>
    </main>
  );
}
