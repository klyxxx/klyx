"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  MapPin,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProjectService = {
  id: string;
  service_slug: string;
  service_label: string;
  position: number;
  estimated_price_min: number | null;
  estimated_price_max: number | null;
  notes: string | null;
  status: string;
};

type ProjectResult = {
  project?: {
    id: string;
    title: string;
    description: string;
    project_type: string | null;
    city: string | null;
    target_date: string | null;
    budget_max: number | null;
    status: string;
  };
  services?: ProjectService[];
  error?: string;
};

export default function NewProjectPage() {
  const router = useRouter();

  const [description, setDescription] =
    useState("");
  const [result, setResult] =
    useState<ProjectResult | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/projects/plan",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            description,
          }),
        }
      );

      const data =
        (await response.json()) as ProjectResult;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Impossible de préparer le projet."
        );
      }

      setResult(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-400 hover:text-white"
        >
          Retour au tableau de bord
        </Link>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
            <FolderKanban size={28} />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            Mode Projet KLYX
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Décris ton objectif complet
          </h1>

          <p className="mt-4 max-w-3xl text-zinc-400">
            KLYX transforme ton objectif en
            plan, services, budget estimé et
            ordre d’exécution.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8"
          >
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Exemple : Je déménage le 15 septembre à Bruxelles avec un budget de 800 €."
              rows={6}
              className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-lg outline-none transition focus:border-violet-500"
            />

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                !description.trim()
              }
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={21} />
              {loading
                ? "KLYX prépare le projet..."
                : "Créer mon plan"}
            </button>
          </form>
        </section>

        {result?.project && (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
            <h2 className="text-3xl font-bold">
              {result.project.title}
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Summary
                icon={<MapPin size={18} />}
                label="Ville"
                value={
                  result.project.city ||
                  "À préciser"
                }
              />

              <Summary
                icon={
                  <CalendarDays size={18} />
                }
                label="Date cible"
                value={
                  result.project.target_date ||
                  "À préciser"
                }
              />

              <Summary
                icon={
                  <WalletCards size={18} />
                }
                label="Budget maximum"
                value={
                  result.project.budget_max !=
                  null
                    ? `${Number(
                        result.project
                          .budget_max
                      ).toFixed(2)} €`
                    : "À préciser"
                }
              />
            </div>

            <h3 className="mt-8 text-xl font-bold">
              Plan recommandé
            </h3>

            <div className="mt-4 space-y-4">
              {(result.services ?? [])
                .slice()
                .sort(
                  (a, b) =>
                    a.position - b.position
                )
                .map((service) => (
                  <article
                    key={service.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 font-bold">
                        {service.position}
                      </div>

                      <div className="flex-1">
                        <h4 className="text-lg font-bold">
                          {
                            service.service_label
                          }
                        </h4>

                        <p className="mt-2 text-sm text-zinc-400">
                          {service.notes}
                        </p>

                        <p className="mt-3 font-semibold text-violet-400">
                          {service.estimated_price_min !=
                            null &&
                          service.estimated_price_max !=
                            null
                            ? `${Number(
                                service.estimated_price_min
                              ).toFixed(
                                2
                              )} € – ${Number(
                                service.estimated_price_max
                              ).toFixed(
                                2
                              )} €`
                            : "Prix à estimer"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
            </div>

            <button
              type="button"
              onClick={() =>
                router.push("/request")
              }
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-semibold text-black hover:bg-zinc-200"
            >
              Trouver les prestataires
              <ArrowRight size={19} />
            </button>
          </section>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        {icon}
        {label}
      </div>

      <p className="mt-2 font-semibold">
        {value}
      </p>
    </div>
  );
}