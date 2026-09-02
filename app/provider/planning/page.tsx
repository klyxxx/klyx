"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
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

// KLYX_PROVIDER_PLANNING_DESTINATION_2026_09_02

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
  automaticChanges?: boolean;
};

function warningTone(severity: Warning["severity"]) {
  if (severity === "high") {
    return "border-red-500/30 text-red-700 dark:text-red-300";
  }

  if (severity === "warning") {
    return "border-amber-500/35 text-amber-700 dark:text-amber-300";
  }

  return "border-blue-600/25 text-blue-700 dark:text-blue-300";
}

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
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <CalendarClock size={17} />
              <span>{t("eyebrow")}</span>
            </div>
            <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">{t("title")}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 w-fit shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground transition hover:border-blue-600/25 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {t("refresh")}
          </button>
        </header>

        {loading && (
          <div className="grid min-h-72 place-items-center" aria-label={t("title")}>
            <LoaderCircle className="animate-spin text-blue-600" size={28} />
          </div>
        )}

        {hasError && (
          <div className="mt-8 border-y border-border py-4 text-sm font-semibold text-red-600 dark:text-red-300">
            {t("genericError")}
          </div>
        )}

        {!loading && data && (
          <>
            <p className="mt-7 text-xs font-medium leading-5 text-muted-foreground">
              {t("noAutomaticChanges")}
            </p>

            {(data.planning?.length ?? 0) === 0 ? (
              <section className="mt-8 border-y border-border py-10 text-center">
                <CheckCircle2
                  className="mx-auto text-emerald-600 dark:text-emerald-400"
                  size={25}
                />
                <h2 className="mt-4 text-xl font-semibold">{t("noAppointments")}</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {t("noAppointmentsDescription")}
                </p>
              </section>
            ) : (
              <section className="mt-8 border-t border-border" aria-label={t("title")}>
                {data.planning?.map((day) => (
                  <article key={day.date} className="border-b border-border py-7 sm:py-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

                      <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        <Clock3 size={14} />
                        {formatKlyxProviderPlanningDuration(day.totalMinutes)}
                      </span>
                    </div>

                    {day.warnings.length > 0 && (
                      <div className="mt-5 space-y-3" aria-label={t("attentionPoints")}>
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
                              className={`border-l-2 py-1 pl-3 ${warningTone(
                                warning.severity
                              )}`}
                            >
                              <div className="flex gap-2.5">
                                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                                <div>
                                  <p className="text-sm font-semibold">
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
                    )}

                    <div className="mt-6 divide-y divide-border border-t border-border">
                      {day.bookings.map((booking) => (
                        <Link
                          key={booking.id}
                          href={`/bookings/${booking.id}`}
                          className="flex flex-col gap-2 py-4 transition hover:text-blue-600 sm:flex-row sm:items-center sm:justify-between"
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

                          <span className="w-fit text-xs font-semibold text-muted-foreground">
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
