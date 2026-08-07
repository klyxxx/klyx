"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  FileText,
  LoaderCircle,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuoteProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Quote = {
  id: string;
  title: string;
  description: string;
  requested_date: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  pricing_type: "hourly" | "fixed";
  estimated_total: number | null;
  provider_price: number | null;
  provider_message: string | null;
  status: string;
  created_at: string;
  client: QuoteProfile | null;
};

function clientName(
  profile: QuoteProfile | null
): string {
  if (!profile) return "Client KLYX";

  return (
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`.trim() || "Client KLYX"
  );
}

export default function ProviderQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [prices, setPrices] = useState<
    Record<string, string>
  >({});
  const [messages, setMessages] = useState<
    Record<string, string>
  >({});
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

      const nextQuotes = body.quotes ?? [];
      setQuotes(nextQuotes);

      setPrices((current) => {
        const next = { ...current };

        for (const quote of nextQuotes) {
          if (
            next[quote.id] == null &&
            quote.estimated_total != null
          ) {
            next[quote.id] = String(
              quote.estimated_total
            );
          }
        }

        return next;
      });
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

  async function sendQuote(
    event: FormEvent,
    quoteId: string
  ) {
    event.preventDefault();

    const providerPrice = Number(
      prices[quoteId]
    );

    if (
      !Number.isFinite(providerPrice) ||
      providerPrice < 0
    ) {
      setErrorMessage(
        "Entre un montant valide."
      );
      return;
    }

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
            action: "send",
            providerPrice,
            providerMessage:
              messages[quoteId] ?? "",
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Envoi impossible."
        );
      }

      setSuccessMessage(
        body.message || "Devis envoyé."
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Envoi impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#164e63_52%,#0f172a)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <FileText size={15} />
            Prestataire uniquement
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Demandes de devis
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Vérifie la demande du client, ajuste le montant,
            puis envoie ton devis. Rien n’est réservé
            automatiquement.
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
              className="animate-spin text-cyan-600"
              size={38}
            />
          </div>
        ) : quotes.length === 0 ? (
          <section className="klyx-card mt-8 p-8 text-center">
            <FileText
              className="mx-auto text-cyan-600"
              size={42}
            />
            <h2 className="mt-4 text-xl font-black">
              Aucune demande de devis
            </h2>
          </section>
        ) : (
          <section className="mt-8 grid gap-5">
            {quotes.map((quote) => (
              <article
                key={quote.id}
                className="klyx-card p-6"
              >
                <p className="klyx-eyebrow">
                  {quote.status}
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {quote.title}
                </h2>

                <p className="mt-2 text-sm font-black text-cyan-700 dark:text-cyan-300">
                  {clientName(quote.client)}
                </p>

                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {quote.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {quote.requested_date && (
                    <span>
                      Date : {quote.requested_date}
                    </span>
                  )}

                  {quote.requested_time && (
                    <span>
                      Heure :{" "}
                      {quote.requested_time.slice(
                        0,
                        5
                      )}
                    </span>
                  )}

                  {quote.duration_hours && (
                    <span>
                      Durée :{" "}
                      {quote.duration_hours} h
                    </span>
                  )}

                  <span>
                    Estimation KLYX :{" "}
                    {quote.estimated_total == null
                      ? "à confirmer"
                      : `${Number(
                          quote.estimated_total
                        ).toFixed(2)} €`}
                  </span>
                </div>

                {quote.status ===
                  "requested" && (
                  <form
                    onSubmit={(event) =>
                      void sendQuote(
                        event,
                        quote.id
                      )
                    }
                    className="mt-6 grid gap-4"
                  >
                    <label>
                      <span className="mb-2 block text-sm font-black">
                        Ton prix final
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          prices[quote.id] ?? ""
                        }
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [quote.id]:
                              event.target.value,
                          }))
                        }
                        className="klyx-input"
                      />
                    </label>

                    <label>
                      <span className="mb-2 block text-sm font-black">
                        Message facultatif
                      </span>
                      <textarea
                        rows={4}
                        maxLength={1500}
                        value={
                          messages[quote.id] ?? ""
                        }
                        onChange={(event) =>
                          setMessages(
                            (current) => ({
                              ...current,
                              [quote.id]:
                                event.target.value,
                            })
                          )
                        }
                        className="klyx-input resize-none"
                        placeholder="Précise ce qui est inclus dans ton prix."
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={
                        busyId === quote.id
                      }
                      className="klyx-button w-full"
                    >
                      {busyId === quote.id ? (
                        <LoaderCircle
                          className="animate-spin"
                          size={18}
                        />
                      ) : (
                        <Send size={18} />
                      )}
                      Envoyer le devis
                    </button>
                  </form>
                )}

                {quote.status !==
                  "requested" && (
                  <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-sm font-black">
                      Prix envoyé :{" "}
                      {quote.provider_price == null
                        ? "—"
                        : `${Number(
                            quote.provider_price
                          ).toFixed(2)} €`}
                    </p>

                    {quote.provider_message && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {quote.provider_message}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
