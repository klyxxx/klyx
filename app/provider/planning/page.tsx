"use client";

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
import { useEffect, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderPlanningDuration,
  getKlyxProviderPlanningIntlLocale,
  translateKlyxProviderPlanning,
  translateKlyxProviderPlanningStatus,
  translateKlyxProviderPlanningWarning,
  type KlyxProviderPlanningMessageKey,
} from "@/lib/klyx-provider-planning-i18n";
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
};

export default function ProviderPlanningPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderPlanningMessageKey) =>
    translateKlyxProviderPlanning(locale, key);

  const [data, setData] = useState<PlanningResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  async function load() {
    setLoading(true);
    setHasError(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Provider planning unavailable");
      }

      const response = await fetch("/api/provider/planning?days=30", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const body = (await response.json()) as PlanningResponse;

      if (!response.ok) {
        throw new Error("Provider planning unavailable");
      }

      setData(body);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <CalendarClock size={17} />
              <span>{t("eyebrow")}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("refresh")}
          </button>
        </header>

        {loading && (
          <div className="grid min-h-72 place-items-center" aria-label={t("title")}>
            <LoaderCircle className="animate-spin text-blue-600" size={34} />
          </div>
        )}

        {hasError && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-red-700 dark:text-red-300">
            {t("genericError")}
          </div>
        )}

        {!loading && data?.summary && (
          <>
            <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {data.summary.bookingCount} {t("missionsAnalyzed")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.summary.warningCount} {t("attentionPoints")}
                    {data.summary.highWarningCount > 0
                      ? ` · ${data.summary.highWarningCount} ${t("priorityConflicts")}`
                      : ""}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <ShieldCheck size={16} className="text-blue-600" />
                  <span>{t("noAutomaticChanges")}</span>
                </div>
              </div>
            </section>

            {(data.planning?.length ?? 0) === 0 ? (
              <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={23} />
                </span>
                <h2 className="mt-4 text-xl font-semibold">
                  {t("noAppointments")}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {t("noAppointmentsDescription")}
                </p>
              </section>
            ) : (
              <section className="mt-8 space-y-4" aria-label={t("title")}>
                {data.planning?.map((day) => (
                  <article
                    key={day.date}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                          {day.date}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold capitalize sm:text-2xl">
                          {new Intl.DateTimeFormat(
                            getKlyxProviderPlanningIntlLocale(locale),
                            {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            }
                          ).format(new Date(`${day.date}T12:00:00`))}
                        </h2>
                      </div>

                      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/8 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        <Clock3 size={14} />
                        {formatKlyxProviderPlanningDuration(day.totalMinutes)}
                      </span>
                    </div>

                    {day.warnings.length > 0 && (
                      <div className="border-b border-border p-5 sm:p-6">
                        <div className="space-y-3">
                          {day.warnings.map((warning, index) => {
                            const localizedWarning =
                              translateKlyxProviderPlanningWarning(
                                locale,
                                warning,
                                day.bookings,
                                day.totalMinutes
                              );

                            return (
                              <div
                                key={`${warning.code}-${index}`}
                                className={`rounded-xl border p-4 ${
                                  warning.severity === "high"
                                    ? "border-red-500/25 bg-red-500/8"
                                    : warning.severity === "warning"
                                      ? "border-amber-500/25 bg-amber-500/8"
                                      : "border-blue-500/20 bg-blue-500/5"
                                }`}
                              >
                                <div className="flex gap-3">
                                  <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                                  <div>
                                    <p className="font-semibold">
                                      {localizedWarning.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                      {localizedWarning.detail}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="divide-y divide-border">
                      {day.bookings.map((booking) => (
                        <Link
                          key={booking.id}
                          href={`/bookings/${booking.id}`}
                          className="flex flex-col gap-3 p-5 transition hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                        >
                          <div>
                            <p className="font-semibold">
                              {booking.startTime.slice(0, 5)}
                              {" – "}
                              {booking.endTime.slice(0, 5)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {booking.clientName}
                            </p>
                          </div>

                          <span className="w-fit rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
                            {translateKlyxProviderPlanningStatus(
                              locale,
                              booking.status
                            )}
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
