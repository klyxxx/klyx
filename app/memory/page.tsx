"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SERVICES = [
  { slug: "babysitting", label: "Baby-sitting" },
  { slug: "cleaning", label: "Ménage" },
  { slug: "moving", label: "Déménagement" },
  { slug: "handyman", label: "Bricolage" },
];

type Preferences = {
  default_city: string | null;
  default_budget: number | null;
  preferred_service_slugs: string[];
  household_notes: string | null;
  scheduling_notes: string | null;
  ai_memory_enabled: boolean;
};

export default function MemoryPage() {
  const router = useRouter();

  const [defaultCity, setDefaultCity] = useState("");
  const [defaultBudget, setDefaultBudget] = useState("");
  const [preferredServices, setPreferredServices] = useState<string[]>([]);
  const [householdNotes, setHouseholdNotes] = useState("");
  const [schedulingNotes, setSchedulingNotes] = useState("");
  const [aiMemoryEnabled, setAiMemoryEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const getToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      router.replace("/login");
      return null;
    }

    return session.access_token;
  }, [router]);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const token = await getToken();

        if (!token) {
          return;
        }

        const response = await fetch("/api/memory/preferences", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const result = (await response.json()) as {
          preferences?: Preferences;
          error?: string;
        };

        if (!response.ok || !result.preferences) {
          throw new Error(result.error || "Chargement impossible.");
        }

        const preferences = result.preferences;

        setDefaultCity(preferences.default_city ?? "");
        setDefaultBudget(
          preferences.default_budget != null
            ? String(preferences.default_budget)
            : ""
        );
        setPreferredServices(preferences.preferred_service_slugs ?? []);
        setHouseholdNotes(preferences.household_notes ?? "");
        setSchedulingNotes(preferences.scheduling_notes ?? "");
        setAiMemoryEnabled(preferences.ai_memory_enabled);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les préférences."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPreferences();
  }, [getToken]);

  function toggleService(slug: string) {
    setPreferredServices((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/memory/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          defaultCity,
          defaultBudget:
            defaultBudget.trim() === "" ? null : Number(defaultBudget),
          preferredServiceSlugs: preferredServices,
          householdNotes,
          schedulingNotes,
          aiMemoryEnabled,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Enregistrement impossible.");
      }

      setMessage("Mémoire KLYX mise à jour.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les préférences."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
          Retour au tableau de bord
        </Link>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
            <Brain size={28} />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            Mémoire personnelle KLYX
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Apprends mes habitudes
          </h1>

          <p className="mt-4 max-w-3xl text-zinc-400">
            Ces informations permettront à KLYX de comprendre plus tard des
            demandes comme « Comme d’habitude ».
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {errorMessage}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Ville habituelle
              </label>
              <input
                value={defaultCity}
                onChange={(event) => setDefaultCity(event.target.value)}
                placeholder="Bruxelles"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Budget habituel maximum par heure
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultBudget}
                onChange={(event) => setDefaultBudget(event.target.value)}
                placeholder="15"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <p className="mb-3 text-sm text-zinc-300">
                Services que tu utilises souvent
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {SERVICES.map((service) => {
                  const selected = preferredServices.includes(service.slug);

                  return (
                    <button
                      key={service.slug}
                      type="button"
                      onClick={() => toggleService(service.slug)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                      }`}
                    >
                      {service.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Informations utiles sur le foyer
              </label>
              <textarea
                rows={4}
                value={householdNotes}
                onChange={(event) => setHouseholdNotes(event.target.value)}
                placeholder="Exemple : deux enfants, un chien, appartement au troisième étage."
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Habitudes de planning
              </label>
              <textarea
                rows={4}
                value={schedulingNotes}
                onChange={(event) => setSchedulingNotes(event.target.value)}
                placeholder="Exemple : ménage le vendredi matin, baby-sitting le samedi soir."
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <input
                type="checkbox"
                checked={aiMemoryEnabled}
                onChange={(event) => setAiMemoryEnabled(event.target.checked)}
                className="h-5 w-5 accent-violet-600"
              />
              <span>Autoriser KLYX à utiliser cette mémoire pour personnaliser les recommandations.</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? "Enregistrement..." : "Enregistrer ma mémoire"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}