"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Crown,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxFounderFinalCheckPageDescription,
  formatKlyxFounderFinalCheckPending,
  formatKlyxFounderFinalCheckProfileCount,
  formatKlyxFounderFinalCheckUnreferenced,
  translateKlyxFounderFinalCheck,
  translateKlyxFounderFinalCheckPageLabel,
  type KlyxFounderFinalCheckMessageKey,
} from "@/lib/klyx-founder-final-check-i18n";

// KLYX_FOUNDER_FINAL_CHECK_I18N

type CheckStatus = "ok" | "warning" | "error";
type FinalCheck = {
  id: string;
  title: string;
  description: string;
  status: CheckStatus;
  detail: string;
  blocking: boolean;
};
type FounderStatus = {
  isFounder?: boolean;
  activeProfileId?: string | null;
  clientProfiles?: Array<{ id: string }>;
  providerProfiles?: Array<{ id: string }>;
};
type AuditResponse = {
  totalUsers?: number;
  protectedUsers?: number;
  unreferencedUsers?: number;
};

const PAGE_PATHS = [
  "/dashboard",
  "/accounts",
  "/profile",
  "/provider",
  "/admin",
  "/founder",
  "/founder/test",
  "/founder/cleanup",
] as const;

export default function FounderFinalCheckPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFounderFinalCheckMessageKey) =>
    translateKlyxFounderFinalCheck(locale, key);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<FinalCheck[]>([]);
  const [error, setError] = useState("");

  const runChecks = useCallback(async () => {
    const tr = (key: KlyxFounderFinalCheckMessageKey) =>
      translateKlyxFounderFinalCheck(locale, key);

    setLoading(true);
    setError("");

    try {
      const results: FinalCheck[] = [];

      const founderResponse = await fetch("/api/founder/status", {
        cache: "no-store",
      });
      const founder = (await founderResponse.json()) as FounderStatus;
      const founderOk = founderResponse.ok && founder.isFounder === true;

      results.push({
        id: "founder",
        title: tr("founderTitle"),
        description: tr("founderDescription"),
        status: founderOk ? "ok" : "error",
        detail: founderOk
          ? tr("founderActive")
          : `${tr("founderUnavailable")} · HTTP ${founderResponse.status}`,
        blocking: true,
      });

      if (!founderOk) {
        setChecks(results);
        return;
      }

      const adminResponse = await fetch("/api/admin/access", {
        cache: "no-store",
      });
      const adminBody = (await adminResponse.json()) as { isAdmin?: boolean };
      const adminOk = adminResponse.ok && adminBody.isAdmin === true;

      results.push({
        id: "admin",
        title: tr("adminTitle"),
        description: tr("adminDescription"),
        status: adminOk ? "ok" : "error",
        detail: adminOk
          ? tr("adminActive")
          : `${tr("adminUnavailable")} · HTTP ${adminResponse.status}`,
        blocking: true,
      });

      const clientCount = founder.clientProfiles?.length ?? 0;
      const providerCount = founder.providerProfiles?.length ?? 0;

      results.push({
        id: "client-profile",
        title: tr("clientProfileTitle"),
        description: tr("clientProfileDescription"),
        status: clientCount > 0 ? "ok" : "error",
        detail: formatKlyxFounderFinalCheckProfileCount(locale, clientCount, "client"),
        blocking: true,
      });

      results.push({
        id: "provider-profile",
        title: tr("providerProfileTitle"),
        description: tr("providerProfileDescription"),
        status: providerCount > 0 ? "ok" : "error",
        detail: formatKlyxFounderFinalCheckProfileCount(locale, providerCount, "provider"),
        blocking: true,
      });

      results.push({
        id: "active-profile",
        title: tr("activeProfileTitle"),
        description: tr("activeProfileDescription"),
        status: founder.activeProfileId ? "ok" : "error",
        detail: founder.activeProfileId ?? tr("noActiveProfile"),
        blocking: true,
      });

      for (const path of PAGE_PATHS) {
        try {
          const response = await fetch(path, { cache: "no-store" });
          const ok = response.status >= 200 && response.status < 400;

          results.push({
            id: `page-${path}`,
            title: translateKlyxFounderFinalCheckPageLabel(locale, path),
            description: formatKlyxFounderFinalCheckPageDescription(locale, path),
            status: ok ? "ok" : "error",
            detail: `HTTP ${response.status}`,
            blocking: true,
          });
        } catch {
          results.push({
            id: `page-${path}`,
            title: translateKlyxFounderFinalCheckPageLabel(locale, path),
            description: formatKlyxFounderFinalCheckPageDescription(locale, path),
            status: "error",
            detail: tr("networkError"),
            blocking: true,
          });
        }
      }

      try {
        const auditResponse = await fetch("/api/founder/accounts-audit", {
          cache: "no-store",
        });
        const audit = (await auditResponse.json()) as AuditResponse;

        if (auditResponse.ok) {
          const remaining = audit.unreferencedUsers ?? 0;
          results.push({
            id: "accounts-cleanup",
            title: tr("cleanupTitle"),
            description: tr("cleanupOkDescription"),
            status: remaining === 0 ? "ok" : "warning",
            detail:
              remaining === 0
                ? tr("cleanupNone")
                : formatKlyxFounderFinalCheckUnreferenced(locale, remaining),
            blocking: false,
          });
        } else {
          results.push({
            id: "accounts-cleanup",
            title: tr("cleanupTitle"),
            description: tr("cleanupAuditDescription"),
            status: "error",
            detail: `${tr("cleanupUnavailable")} · HTTP ${auditResponse.status}`,
            blocking: true,
          });
        }
      } catch {
        results.push({
          id: "accounts-cleanup",
          title: tr("cleanupTitle"),
          description: tr("cleanupAuditDescription"),
          status: "error",
          detail: tr("cleanupUnavailable"),
          blocking: true,
        });
      }

      try {
        const sumsubResponse = await fetch("/api/provider/sumsub/status", {
          cache: "no-store",
        });
        results.push({
          id: "sumsub",
          title: tr("sumsubTitle"),
          description: tr("sumsubDescription"),
          status: sumsubResponse.ok ? "ok" : "warning",
          detail: sumsubResponse.ok
            ? `HTTP ${sumsubResponse.status}`
            : formatKlyxFounderFinalCheckPending(locale, sumsubResponse.status),
          blocking: false,
        });
      } catch {
        results.push({
          id: "sumsub",
          title: tr("sumsubTitle"),
          description: tr("sumsubDescription"),
          status: "warning",
          detail: formatKlyxFounderFinalCheckPending(locale),
          blocking: false,
        });
      }

      setChecks(results);
    } catch {
      setError(tr("loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const summary = useMemo(() => {
    const blockers = checks.filter(
      (item) => item.blocking && item.status === "error"
    ).length;
    const ok = checks.filter((item) => item.status === "ok").length;
    const warnings = checks.filter((item) => item.status === "warning").length;

    return {
      ready: checks.length > 0 && blockers === 0,
      blockers,
      ok,
      warnings,
    };
  }, [checks]);

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/founder"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} /> {t("backFounder")}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Crown size={15} /> {t("badge")}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={loading}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {t("rerun")}
          </button>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        <section
          className={`mt-6 rounded-3xl border p-6 ${
            summary.ready
              ? "border-emerald-500/20 bg-emerald-500/10"
              : "border-rose-500/20 bg-rose-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{t("step")}</p>
              <h2 className="mt-2 text-2xl font-black">
                {summary.ready ? t("readyTitle") : t("notReadyTitle")}
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
            <Metric label={t("ok")} value={summary.ok} />
            <Metric label={t("warnings")} value={summary.warnings} />
            <Metric label={t("blockers")} value={summary.blockers} />
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <article
              key={check.id}
              className={`rounded-2xl border p-5 ${
                check.status === "ok"
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : check.status === "warning"
                    ? "border-amber-500/20 bg-amber-500/10"
                    : "border-rose-500/20 bg-rose-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {check.status === "ok" ? (
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-500" />
                ) : (
                  <CircleAlert
                    size={20}
                    className={`mt-0.5 shrink-0 ${
                      check.status === "warning" ? "text-amber-500" : "text-rose-500"
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{check.title}</h2>
                    {!check.blocking && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-600">
                        {t("nonBlocking")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{check.description}</p>
                  <p className="mt-3 break-all text-xs font-bold text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {summary.ready && (
          <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
            <div className="flex gap-3">
              <ShieldCheck size={24} className="shrink-0 text-emerald-600" />
              <div>
                <h2 className="text-xl font-black">{t("validatedTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("validatedDescription")}</p>
              </div>
            </div>
          </section>
        )}
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
