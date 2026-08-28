"use client";

import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxDashboard,
  type KlyxDashboardMessageKey,
  type KlyxDashboardMessageValues,
} from "@/lib/klyx-dashboard-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_GROUP_ACTIVITY_UI_13_02

type ActivitySummary = {
  groupAware: boolean;
  missions: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    single: number;
    grouped: number;
    completionRate: number;
    cancellationRate: number;
  };
  execution: {
    totalSlots: number;
    completedSlots: number;
    groupedSlots: number;
  };
  automaticExecutionAllowed: false;
};

function percentage(value: number) {
  return `${Number(value).toFixed(1)}%`;
}

export default function ProviderActivitySnapshot() {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxDashboardMessageKey,
    values?: KlyxDashboardMessageValues
  ) => translateKlyxDashboard(locale, key, values);
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("missing-session");
      }

      const response = await fetch("/api/provider/activity-summary", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const body = (await response.json()) as ActivitySummary;

      if (!response.ok) {
        throw new Error("provider-activity-load-failed");
      }

      setData(body);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="klyx-eyebrow">{t("activityEyebrow")}</p>

            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={12} />
              {t("activityGroupAware")}
            </span>
          </div>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {t("activityTitle")}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("activityDescription")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-black transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {t("activityRefresh")}
        </button>
      </div>

      {loading && !data ? (
        <div className="klyx-card mt-5 grid min-h-40 place-items-center">
          <LoaderCircle className="animate-spin text-blue-600" size={30} />
        </div>
      ) : null}

      {loadFailed && !data ? (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {t("activityLoadFailed")}
        </div>
      ) : null}

      {data ? (
        <>
          {/* KLYX_PROVIDER_COMMERCIAL_METRICS_13_02 */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={<Activity size={19} />}
              label={t("activityCommercialMissions")}
              value={data.missions.total}
              detail={t("activityActiveDetail", {
                count: data.missions.active,
              })}
            />

            <Metric
              icon={<CheckCircle2 size={19} />}
              label={t("activityCompletedMissions")}
              value={data.missions.completed}
              detail={t("activityCompletionDetail", {
                percent: percentage(data.missions.completionRate),
              })}
            />

            <Metric
              icon={<Layers3 size={19} />}
              label={t("activityGroupedMissions")}
              value={data.missions.grouped}
              detail={t("activitySingleDetail", {
                count: data.missions.single,
              })}
            />

            <Metric
              icon={<CalendarDays size={19} />}
              label={t("activityExecutedSlots")}
              value={data.execution.completedSlots}
              detail={t("activityTotalSlotsDetail", {
                count: data.execution.totalSlots,
              })}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">
                {t("activityCancellationRate", {
                  percent: percentage(data.missions.cancellationRate),
                })}
              </p>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("activityCancellationDescription")}
              </p>
            </div>

            <Link
              href="/scores"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-4 text-xs font-black text-white transition hover:bg-violet-700"
            >
              {t("activityViewScore")}
            </Link>
          </div>

          {loadFailed ? (
            <p className="mt-3 text-xs text-rose-600">
              {t("activityRefreshFailed")}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="klyx-card p-5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-black">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}
