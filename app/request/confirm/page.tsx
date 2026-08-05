"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";

type ConfirmedRequest = {
  service: string;
  city: string;
  date: string;
  time: string;
  budget: string;
};

const serviceLabels: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Ménage",
  moving: "Déménagement",
  handyman: "Bricolage",
};

function ConfirmRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRequest = useMemo<ConfirmedRequest>(
    () => ({
      service: searchParams.get("service")?.trim() ?? "",
      city: searchParams.get("city")?.trim() ?? "",
      date: searchParams.get("date")?.trim() ?? "",
      time: searchParams.get("time")?.trim() ?? "",
      budget: searchParams.get("budget")?.trim() ?? "",
    }),
    [searchParams]
  );

  const [request, setRequest] = useState(initialRequest);

  function update<Key extends keyof ConfirmedRequest>(
    key: Key,
    value: ConfirmedRequest[Key]
  ) {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  function continueToSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();

    if (request.service) params.set("service", request.service);
    if (request.city.trim()) params.set("city", request.city.trim());
    if (request.date) params.set("date", request.date);
    if (request.time) params.set("time", request.time);
    if (request.budget && Number(request.budget) >= 0) {
      params.set("budget", request.budget);
    }

    router.push(`/recommendations?${params.toString()}`);
  }

  const serviceLabel =
    serviceLabels[request.service] ||
    request.service ||
    "Service à préciser";

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/brain"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Revenir à l’assistant
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-violet-500/25 blur-3xl" />

          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              <Sparkles size={15} />
              Vérification rapide
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              Confirme ta demande
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              KLYX a préparé les critères principaux. Corrige seulement ce qui
              est nécessaire, puis lance la recherche.
            </p>
          </div>
        </section>

        <form
          onSubmit={continueToSearch}
          className="klyx-card mt-8 p-6 sm:p-8"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              icon={<Search size={18} />}
              label="Service"
              summary={serviceLabel}
            >
              <input
                value={request.service}
                onChange={(event) => update("service", event.target.value)}
                className="klyx-input"
                placeholder="babysitting, cleaning..."
                required
              />
            </Field>

            <Field
              icon={<MapPin size={18} />}
              label="Ville"
              summary={request.city || "À préciser"}
            >
              <input
                value={request.city}
                onChange={(event) => update("city", event.target.value)}
                className="klyx-input"
                placeholder="Bruxelles"
                required
              />
            </Field>

            <Field
              icon={<CalendarDays size={18} />}
              label="Date"
              summary={request.date || "À préciser"}
            >
              <input
                type="date"
                value={request.date}
                onChange={(event) => update("date", event.target.value)}
                className="klyx-input"
                required
              />
            </Field>

            <Field
              icon={<Clock3 size={18} />}
              label="Heure"
              summary={request.time || "À préciser"}
            >
              <input
                type="time"
                value={request.time}
                onChange={(event) => update("time", event.target.value)}
                className="klyx-input"
                required
              />
            </Field>

            <Field
              icon={<Euro size={18} />}
              label="Budget maximum"
              summary={
                request.budget ? `${request.budget} €` : "Aucun maximum"
              }
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={request.budget}
                onChange={(event) => update("budget", event.target.value)}
                className="klyx-input"
                placeholder="Facultatif"
              />
            </Field>

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={21}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                />
                <div>
                  <p className="font-black text-emerald-800 dark:text-emerald-200">
                    Aucun paiement maintenant
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                    Cette étape lance uniquement la recherche. Une réservation
                    devra encore être vérifiée et confirmée.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500"
          >
            Afficher la sélection KLYX
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  summary,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-5">
      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
        {icon}
        <span className="text-xs font-black uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>

      <p className="mt-2 text-lg font-black">{summary}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function ConfirmRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground">
            Préparation de ta demande...
          </div>
        </main>
      }
    >
      <ConfirmRequestContent />
    </Suspense>
  );
}
