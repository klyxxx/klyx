"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Warning = {
  code: string;
  severity: "info" | "warning" | "high";
  title: string;
  detail: string;
  bookingIds: string[];
};

type Booking = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceStatus: string | null;
  clientName: string;
};

type PlanningDay = {
  date: string;
  totalMinutes: number;
  bookings: Booking[];
  warnings: Warning[];
};

type PlanningResponse = {
  planning?: PlanningDay[];
  summary?: {
    bookingCount: number;
    warningCount: number;
    highWarningCount: number;
  };
  automaticChanges?: boolean;
  error?: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Confirmée",
  completed: "Terminée",
};

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

function durationLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;

  return `${hours} h ${minutes} min`;
}

export default function ProviderPlanningPage() {
  const [data, setData] =
    useState<PlanningResponse | null>(null);
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
        "/api/provider/planning?days=30",
        {
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const body =
        (await response.json()) as PlanningResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      setData(body);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger le planning."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#193a52_52%,#0f172a)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <CalendarClock size={15} />
            Planning prestataire uniquement
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Planning intelligent
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            KLYX analyse les trente prochains jours et signale
            les créneaux risqués sans déplacer ni annuler aucune
            mission.
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
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle
              className="animate-spin text-blue-600"
              size={38}
            />
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {!loading && data?.summary && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Missions analysées"
                value={data.summary.bookingCount}
                icon={<CalendarClock size={21} />}
              />
              <SummaryCard
                label="Points d’attention"
                value={data.summary.warningCount}
                icon={<AlertTriangle size={21} />}
              />
              <SummaryCard
                label="Conflits prioritaires"
                value={data.summary.highWarningCount}
                icon={<ShieldCheck size={21} />}
              />
            </section>

            <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              Aucune modification automatique : tu gardes le
              contrôle de toutes les réservations.
            </div>

            {(data.planning?.length ?? 0) === 0 ? (
              <section className="klyx-card mt-8 p-8 text-center">
                <CheckCircle2
                  className="mx-auto text-emerald-500"
                  size={42}
                />
                <h2 className="mt-4 text-xl font-black">
                  Aucun rendez-vous prochain
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les futures missions apparaîtront ici.
                </p>
              </section>
            ) : (
              <section className="mt-8 grid gap-6">
                {data.planning?.map((day) => (
                  <article
                    key={day.date}
                    className="klyx-card p-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="klyx-eyebrow">
                          {day.date}
                        </p>
                        <h2 className="mt-2 text-2xl font-black capitalize">
                          {dateLabel(day.date)}
                        </h2>
                      </div>

                      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-700 dark:text-blue-300">
                        <Clock3 size={14} />
                        {durationLabel(day.totalMinutes)}
                      </span>
                    </div>

                    {day.warnings.length > 0 && (
                      <div className="mt-5 grid gap-3">
                        {day.warnings.map(
                          (warning, index) => (
                            <div
                              key={`${warning.code}-${index}`}
                              className={`rounded-2xl border p-4 ${
                                warning.severity === "high"
                                  ? "border-rose-500/25 bg-rose-500/10"
                                  : warning.severity === "warning"
                                    ? "border-amber-500/25 bg-amber-500/10"
                                    : "border-blue-500/25 bg-blue-500/10"
                              }`}
                            >
                              <div className="flex gap-3">
                                <AlertTriangle
                                  className="mt-0.5 shrink-0"
                                  size={18}
                                />
                                <div>
                                  <p className="font-black">
                                    {warning.title}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    {warning.detail}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div className="mt-5 grid gap-3">
                      {day.bookings.map((booking) => (
                        <Link
                          key={booking.id}
                          href={`/bookings/${booking.id}`}
                          className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-black">
                              {booking.startTime.slice(0, 5)}
                              {" – "}
                              {booking.endTime.slice(0, 5)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {booking.clientName}
                            </p>
                          </div>

                          <span className="w-fit rounded-full bg-muted px-3 py-1.5 text-xs font-black">
                            {STATUS_LABELS[booking.status] ??
                              booking.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="klyx-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">
            {value}
          </p>
        </div>

        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          {icon}
        </span>
      </div>
    </article>
  );
}
