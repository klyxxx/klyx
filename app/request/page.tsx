"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Brain,
  CalendarDays,
  MapPin,
  Search,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ParsedRequest = {
  serviceSlug: string | null;
  city: string | null;
  requestedDay: string | null;
  requestedTime: string | null;
  budgetMax: number | null;
  peopleCount: number | null;
  urgency: "normal" | "today" | "urgent";
  memoryUsed: boolean;
  memoryMessage: string | null;
};

const labels: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Ménage",
  moving: "Déménagement",
  handyman: "Bricolage",
};

export default function RequestPage() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setParsed(null);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/requests/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text }),
      });

      const result = (await response.json()) as {
        parsed?: ParsedRequest;
        error?: string;
      };

      if (!response.ok || !result.parsed) {
        throw new Error(result.error || "Analyse impossible.");
      }

      setParsed(result.parsed);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  function openResults() {
    if (!parsed) return;

    const params = new URLSearchParams();

    if (parsed.serviceSlug) params.set("service", parsed.serviceSlug);
    if (parsed.city) params.set("city", parsed.city);
    if (parsed.requestedDay) params.set("date", parsed.requestedDay);
    if (parsed.requestedTime) {
      params.set("time", parsed.requestedTime.slice(0, 5));
      params.set("duration", "1");
    }
    if (parsed.budgetMax != null) {
      params.set("budget", String(parsed.budgetMax));
    }
    if (text.trim()) params.set("q", text.trim().slice(0, 240));

    router.push(`/search?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="text-sm text-zinc-400">
            Retour au tableau de bord
          </Link>

          <Link
            href="/memory"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-900"
          >
            <Brain size={17} />
            Ma mémoire KLYX
          </Link>
        </div>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
            <Sparkles size={28} />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            Assistant KLYX
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            De quoi as-tu besoin ?
          </h1>

          <p className="mt-4 text-zinc-400">
            Décris ton besoin ou écris « Comme d'habitude ».
          </p>

          <form onSubmit={analyze} className="mt-8">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Exemple : Comme d'habitude, demain à 18h."
              rows={6}
              className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-lg outline-none focus:border-violet-500"
            />

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              <Search size={21} />
              {loading ? "KLYX analyse..." : "Analyser ma demande"}
            </button>
          </form>

          {parsed && (
            <section className="mt-8 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
              <h2 className="text-xl font-bold">KLYX a compris</h2>

              {parsed.memoryUsed && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-200">
                  <Brain size={20} />
                  {parsed.memoryMessage}
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info
                  icon={<Sparkles size={18} />}
                  label="Service"
                  value={
                    parsed.serviceSlug
                      ? labels[parsed.serviceSlug] || parsed.serviceSlug
                      : "À préciser"
                  }
                />
                <Info
                  icon={<MapPin size={18} />}
                  label="Ville"
                  value={parsed.city || "À préciser"}
                />
                <Info
                  icon={<CalendarDays size={18} />}
                  label="Date et heure"
                  value={
                    [
                      parsed.requestedDay,
                      parsed.requestedTime?.slice(0, 5),
                    ]
                      .filter(Boolean)
                      .join(" à ") || "À préciser"
                  }
                />
                <Info
                  icon={<WalletCards size={18} />}
                  label="Budget maximum"
                  value={
                    parsed.budgetMax != null
                      ? `${parsed.budgetMax.toFixed(2)} €`
                      : "À préciser"
                  }
                />
                {parsed.peopleCount != null && (
                  <Info
                    icon={<Users size={18} />}
                    label="Nombre d'enfants"
                    value={String(parsed.peopleCount)}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={openResults}
                className="mt-6 w-full rounded-xl bg-white px-6 py-4 font-semibold text-black hover:bg-zinc-200"
              >
                Voir les prestataires adaptés
              </button>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
