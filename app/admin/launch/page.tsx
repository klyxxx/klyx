"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxAdminLaunchProbeDetail,
  getKlyxAdminLaunchProbeCopy,
  translateKlyxAdminLaunch,
  type KlyxAdminLaunchMessageKey,
  type KlyxAdminLaunchProbeId,
} from "@/lib/klyx-admin-launch-i18n";
import { createClient } from "@/lib/supabase/client";

// KLYX_ADMIN_LAUNCH_I18N

type CheckStatus = "ok" | "warning" | "error";

type LaunchCheck = {
  id: KlyxAdminLaunchProbeId;
  href: string;
  status: CheckStatus;
  httpStatus: number | null;
  blocking: boolean;
};

type Probe = {
  id: KlyxAdminLaunchProbeId;
  path: string;
  blocking: boolean;
  auth?: boolean;
  optional?: boolean;
};

const PROBES: Probe[] = [
  { id: "home", path: "/", blocking: true },
  { id: "login", path: "/login", blocking: true },
  { id: "signup", path: "/signup", blocking: true },
  { id: "install", path: "/install", blocking: true },
  { id: "manifest", path: "/manifest.webmanifest", blocking: true },
  { id: "service-worker", path: "/sw.js", blocking: true },
  { id: "offline", path: "/offline", blocking: true },
  {
    id: "verifications",
    path: "/api/admin/verifications",
    blocking: true,
    auth: true,
  },
  {
    id: "skills",
    path: "/api/admin/skill-verifications",
    blocking: true,
    auth: true,
  },
  {
    id: "stripe",
    path: "/api/admin/stripe-readiness",
    blocking: true,
    auth: true,
  },
  {
    id: "sumsub",
    path: "/api/admin/sumsub",
    blocking: false,
    auth: true,
    optional: true,
  },
];

function statusClass(status: CheckStatus) {
  if (status === "ok") {
    return "border-emerald-500/20 bg-emerald-500/10";
  }

  if (status === "warning") {
    return "border-amber-500/20 bg-amber-500/10";
  }

  return "border-rose-500/20 bg-rose-500/10";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") {
    return <CheckCircle2 size={20} className="text-emerald-500" />;
  }

  return (
    <CircleAlert
      size={20}
      className={status === "warning" ? "text-amber-500" : "text-rose-500"}
    />
  );
}

export default function AdminLaunchPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAdminLaunchMessageKey) =>
    translateKlyxAdminLaunch(locale, key);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorKey, setErrorKey] = useState<KlyxAdminLaunchMessageKey | null>(null);
  const [checks, setChecks] = useState<LaunchCheck[]>([]);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setErrorKey(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setAllowed(false);
        setChecks([]);
        setErrorKey("sessionMissing");
        return;
      }

      const accessResponse = await fetch("/api/admin/access", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const accessBody = (await accessResponse
        .json()
        .catch(() => ({}))) as { isAdmin?: boolean };

      if (!accessResponse.ok || !accessBody.isAdmin) {
        setAllowed(false);
        setChecks([]);
        setErrorKey("accessDenied");
        return;
      }

      setAllowed(true);

      const results = await Promise.all(
        PROBES.map(async (probe): Promise<LaunchCheck> => {
          try {
            const response = await fetch(probe.path, {
              cache: "no-store",
              headers: probe.auth
                ? {
                    Authorization: `Bearer ${session.access_token}`,
                  }
                : undefined,
            });

            const ok = response.status >= 200 && response.status < 400;

            return {
              id: probe.id,
              href: probe.path,
              status: ok ? "ok" : probe.optional ? "warning" : "error",
              httpStatus: response.status,
              blocking: probe.blocking,
            };
          } catch {
            return {
              id: probe.id,
              href: probe.path,
              status: probe.optional ? "warning" : "error",
              httpStatus: null,
              blocking: probe.blocking,
            };
          }
        })
      );

      setChecks(results);
    } catch {
      setAllowed(false);
      setChecks([]);
      setErrorKey("auditError");
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runAudit();
  }, [runAudit]);

  const summary = useMemo(() => {
    const blocking = checks.filter((item) => item.blocking);
    const blockingErrors = blocking.filter((item) => item.status === "error").length;
    const ok = checks.filter((item) => item.status === "ok").length;
    const warnings = checks.filter((item) => item.status === "warning").length;

    return {
      ready: checks.length > 0 && blockingErrors === 0,
      ok,
      warnings,
      blockingErrors,
    };
  }, [checks]);

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle size={38} className="animate-spin" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl">
          <section className="klyx-card p-8">
            <ShieldCheck size={34} className="text-rose-500" />
            <h1 className="mt-5 text-2xl font-black">{t("deniedTitle")}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {errorKey ? t(errorKey) : t("inaccessible")}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("backAdmin")}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Rocket size={15} />
            {t("step")}
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runAudit()}
              disabled={running}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
            >
              {running ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              {t("rerun")}
            </button>
          </div>
        </section>

        <section
          className={`mt-6 rounded-2xl border p-6 ${
            summary.ready
              ? "border-emerald-500/20 bg-emerald-500/10"
              : "border-rose-500/20 bg-rose-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                {t("globalState")}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {summary.ready ? t("readyTitle") : t("blockedTitle")}
              </h2>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-black ${
                summary.ready
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-rose-500/15 text-rose-600"
              }`}
            >
              {summary.ready ? t("readyBadge") : t("notReadyBadge")}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label={t("okMetric")} value={summary.ok} />
            <Metric label={t("warningsMetric")} value={summary.warnings} />
            <Metric label={t("blockersMetric")} value={summary.blockingErrors} />
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {checks.map((check) => {
            const copy = getKlyxAdminLaunchProbeCopy(locale, check.id);

            return (
              <article
                key={check.id}
                className={`rounded-2xl border p-5 ${statusClass(check.status)}`}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon status={check.status} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-black">{copy.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {copy.description}
                        </p>
                      </div>

                      {!check.blocking && (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-600">
                          {t("optional")}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-muted-foreground">
                        {formatKlyxAdminLaunchProbeDetail(locale, check.httpStatus)}
                      </span>

                      {check.href && !check.href.startsWith("/api/") && (
                        <Link
                          href={check.href}
                          className="inline-flex items-center gap-1 text-xs font-black text-violet-600"
                        >
                          {t("open")}
                          <ExternalLink size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="klyx-card mt-8 p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            {t("launchRule")}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t("launchRuleText")}
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
