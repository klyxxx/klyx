"use client";

import { FormEvent, useEffect, useState } from "react";
import { Euro, LoaderCircle, MapPin, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

type MarketRequest = {
  id: string;
  title: string;
  description: string;
  city: string;
  requested_date: string | null;
  requested_time: string | null;
  budget_max: number | null;
  service: { name: string; slug: string } | null;
  myOffer: {
    id: string;
    amount: number;
    message: string | null;
    status: string;
  } | null;
};

async function token() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Session manquante.");
  return session.access_token;
}

export default function ProviderJobsPage() {
  const [requests, setRequests] = useState<MarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/market/requests", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await response.json();

      if (!response.ok) throw new Error(body.error || "Chargement impossible.");

      const rows = body.requests ?? [];
      setRequests(rows);

      const nextAmounts: Record<string, string> = {};
      const nextMessages: Record<string, string> = {};

      for (const row of rows) {
        if (row.myOffer) {
          nextAmounts[row.id] = String(row.myOffer.amount);
          nextMessages[row.id] = row.myOffer.message ?? "";
        }
      }

      setAmounts(nextAmounts);
      setMessages(nextMessages);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submitOffer(event: FormEvent, requestId: string) {
    event.preventDefault();
    setBusy(requestId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const amount = Number(amounts[requestId]);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Entre un montant valide.");
      }

      const response = await fetch(`/api/market/requests/${requestId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount,
          message: messages[requestId] ?? "",
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Offre impossible.");

      setSuccessMessage(body.message || "Offre envoyée.");
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Offre impossible.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#1e3a5f_50%,#0f172a)] p-7 text-white sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200/70">
            Opportunités KLYX
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">
            Missions compatibles avec tes métiers
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            KLYX ne te montre ici que les demandes ouvertes correspondant à au moins un métier actif de ton profil.
          </p>
        </section>

        {successMessage && <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">{successMessage}</div>}
        {errorMessage && <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">{errorMessage}</div>}

        {loading ? (
          <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-blue-600" size={36}/></div>
        ) : requests.length === 0 ? (
          <div className="klyx-card mt-7 p-8 text-center text-muted-foreground">
            Aucune mission compatible ouverte pour le moment.
          </div>
        ) : (
          <div className="mt-7 grid gap-5">
            {requests.map((item) => (
              <article key={item.id} className="klyx-card p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                      {item.service?.name ?? "Service KLYX"}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{item.title}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={16}/>{item.city}</p>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>

                  {item.budget_max != null && (
                    <div className="rounded-2xl border border-border bg-background p-4 text-right">
                      <p className="text-xs font-black text-muted-foreground">Budget client</p>
                      <p className="mt-1 text-2xl font-black">{Number(item.budget_max).toFixed(2)} €</p>
                    </div>
                  )}
                </div>

                <form onSubmit={(event) => void submitOffer(event, item.id)} className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-[180px_1fr_auto]">
                  <label>
                    <span className="mb-2 flex items-center gap-2 text-sm font-black"><Euro size={16}/>Ton prix</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="klyx-input"
                      value={amounts[item.id] ?? ""}
                      onChange={(e) => setAmounts((current) => ({ ...current, [item.id]: e.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-black">Message au client</span>
                    <input
                      className="klyx-input"
                      maxLength={1500}
                      value={messages[item.id] ?? ""}
                      onChange={(e) => setMessages((current) => ({ ...current, [item.id]: e.target.value }))}
                      placeholder="Explique pourquoi tu corresponds à cette mission."
                    />
                  </label>

                  <button
                    disabled={busy === item.id}
                    className="klyx-button self-end"
                  >
                    {busy === item.id ? <LoaderCircle className="animate-spin" size={17}/> : <Send size={17}/>}
                    {item.myOffer ? "Mettre à jour" : "Envoyer l’offre"}
                  </button>
                </form>

                {item.myOffer && (
                  <p className="mt-3 text-xs font-black uppercase text-muted-foreground">
                    Offre actuelle : {item.myOffer.status}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
