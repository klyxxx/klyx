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
  formatKlyxFounderTestDateTime,
  translateKlyxFounderTest,
  translateKlyxFounderTestGroup,
  type KlyxFounderTestMessageKey,
} from "@/lib/klyx-founder-test-i18n";

// KLYX_FOUNDER_TEST_I18N

type Status = "ok" | "warning" | "error";
type Check = {
  id: string;
  group: string;
  title: string;
  status: Status;
  detail: string;
  blocking: boolean;
};
type Report = {
  generatedAt: string;
  ready: boolean;
  summary: { total: number; ok: number; warnings: number; blockers: number };
  checks: Check[];
};

const GROUP_ORDER = [
  "Accès",
  "Profils",
  "Catalogue",
  "Prestataire",
  "Client",
  "Transactions",
  "Paiement",
  "Vérification",
  "Sécurité",
  "Beta 12.6",
];

export default function FounderTestPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFounderTestMessageKey) => translateKlyxFounderTest(locale, key);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const runChecks = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const response = await fetch("/api/founder/test-center", {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as Partial<Report>;

      if (
        !response.ok ||
        typeof body.ready !== "boolean" ||
        !body.summary ||
        !Array.isArray(body.checks) ||
        typeof body.generatedAt !== "string"
      ) {
        setReport(null);
        setLoadFailed(true);
        return;
      }

      setReport(body as Report);
    } catch {
      setReport(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const groups = useMemo(() => {
    const map = new Map<string, Check[]>();
    for (const check of report?.checks ?? []) {
      const current = map.get(check.group) ?? [];
      current.push(check);
      map.set(check.group, current);
    }

    const orderedNames = GROUP_ORDER.filter((group) => map.has(group));
    const remainingNames = Array.from(map.keys()).filter(
      (group) => !GROUP_ORDER.includes(group)
    );

    return [...orderedNames, ...remainingNames].map((group) => ({
      name: group,
      checks: map.get(group) ?? [],
    }));
  }, [report]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/founder"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={17} /> {t("backFounder")}
        </Link>

        <section className="mt-5 rounded-3xl bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]">
              <Crown size={14} /> {t("badge")}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black">12.6</span>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{t("description")}</p>

          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={loading}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950 disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            {t("rerun")}
          </button>
        </section>

        {loadFailed && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {t("loadError")}
          </div>
        )}

        {report && (
          <>
            <section
              className={`mt-5 rounded-3xl border p-5 ${
                report.ready
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : "border-rose-500/20 bg-rose-500/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{t("overall")}</p>
                  <h2 className="mt-1 text-2xl font-black">
                    {report.ready ? t("readyTitle") : t("notReadyTitle")}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-black ${
                    report.ready
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-rose-500/15 text-rose-600"
                  }`}
                >
                  {report.ready ? t("readyBadge") : t("notReadyBadge")}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label={t("tests")} value={report.summary.total} />
                <Metric label={t("ok")} value={report.summary.ok} />
                <Metric label={t("warnings")} value={report.summary.warnings} />
                <Metric label={t("blockers")} value={report.summary.blockers} />
              </div>
            </section>

            <div className="mt-6 space-y-6">
              {groups.map((group) => (
                <section key={group.name}>
                  <h2 className="mb-3 text-lg font-black">
                    {translateKlyxFounderTestGroup(locale, group.name)}
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.checks.map((check) => (
                      <article
                        key={check.id}
                        className={`min-w-0 rounded-2xl border p-4 ${
                          check.status === "ok"
                            ? "border-emerald-500/20 bg-emerald-500/10"
                            : check.status === "warning"
                              ? "border-amber-500/20 bg-amber-500/10"
                              : "border-rose-500/20 bg-rose-500/10"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {check.status === "ok" ? (
                            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-500" />
                          ) : (
                            <CircleAlert
                              size={19}
                              className={`mt-0.5 shrink-0 ${
                                check.status === "warning" ? "text-amber-500" : "text-rose-500"
                              }`}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black">{check.title}</h3>
                              {!check.blocking && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-600">
                                  {t("nonBlocking")}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{check.detail}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section className="mt-8 grid gap-3 sm:grid-cols-3">
              <Link href="/dashboard" className="rounded-2xl border border-border bg-card p-4 font-black hover:bg-muted">
                {t("testClient")}
              </Link>
              <Link href="/provider" className="rounded-2xl border border-border bg-card p-4 font-black hover:bg-muted">
                {t("testProvider")}
              </Link>
              <Link href="/admin" className="rounded-2xl border border-border bg-card p-4 font-black hover:bg-muted">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={18} /> {t("testAdmin")}</span>
              </Link>
            </section>

            <p className="mt-6 text-xs text-muted-foreground">
              {t("lastDiagnostic")}: {formatKlyxFounderTestDateTime(locale, report.generatedAt)}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
