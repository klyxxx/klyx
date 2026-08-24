"use client";

import Link from "next/link";
import { ArrowLeft, Banknote, CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxAdminFinanceConnect,
  translateKlyxAdminFinance,
  translateKlyxAdminFinanceCheck,
  translateKlyxAdminFinanceMode,
  type KlyxAdminFinanceMessageKey,
} from "@/lib/klyx-admin-finance-i18n";
import { createClient } from "@/lib/supabase/client";

// KLYX_ADMIN_FINANCE_READ_ONLY

type Check = { key: string; ok: boolean };
type StripeReadiness = {
  mode?: string;
  ready?: boolean;
  livePaymentsEnabled?: boolean;
  checks?: Check[];
  connectReady?: boolean;
  connectChecks?: Array<{ ok: boolean }>;
};
type WebhookHealth = {
  ready?: boolean;
  endpoint?: string;
  checks?: Check[];
};

export default function AdminFinancePage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAdminFinanceMessageKey) => translateKlyxAdminFinance(locale, key);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<KlyxAdminFinanceMessageKey | null>(null);
  const [runtime, setRuntime] = useState<StripeReadiness | null>(null);
  const [webhook, setWebhook] = useState<WebhookHealth | null>(null);

  async function load() {
    setLoading(true);
    setErrorKey(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrorKey("sessionMissing");
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [runtimeResponse, webhookResponse] = await Promise.all([
        fetch("/api/admin/stripe-readiness", { cache: "no-store", headers }),
        fetch("/api/admin/stripe-webhook-health", { cache: "no-store", headers }),
      ]);

      const [runtimeBody, webhookBody] = await Promise.all([
        runtimeResponse.json().catch(() => ({})),
        webhookResponse.json().catch(() => ({})),
      ]);

      if (!runtimeResponse.ok || !webhookResponse.ok) {
        setErrorKey("loadError");
        return;
      }

      setRuntime(runtimeBody as StripeReadiness);
      setWebhook(webhookBody as WebhookHealth);
    } catch {
      setErrorKey("loadError");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const overallReady = Boolean(runtime?.ready && webhook?.ready);
  const connectChecks = runtime?.connectChecks ?? [];
  const connectOk = useMemo(
    () => connectChecks.filter((check) => check.ok).length,
    [connectChecks]
  );

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin" size={38} />
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ArrowLeft size={17} />
          {t("backAdmin")}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} />
            {t("readOnly")}
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950"
          >
            <RefreshCw size={17} />
            {t("refresh")}
          </button>
        </section>

        {errorKey && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-600">
            {t(errorKey)}
          </div>
        )}

        {!errorKey && runtime && webhook && (
          <>
            <section className={`mt-6 rounded-2xl border p-6 ${overallReady ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{t("overall")}</p>
              <div className="mt-3 flex items-center gap-3">
                {overallReady ? <CheckCircle2 className="text-emerald-500" /> : <CircleAlert className="text-amber-500" />}
                <h2 className="text-2xl font-black">{overallReady ? t("ready") : t("blocked")}</h2>
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <DiagnosticCard
                title={t("stripeRuntime")}
                ready={Boolean(runtime.ready)}
                readyLabel={t("ready")}
                blockedLabel={t("blocked")}
                checks={runtime.checks ?? []}
                locale={locale}
              >
                <p>{t("mode")}: <strong>{translateKlyxAdminFinanceMode(locale, runtime.mode)}</strong></p>
                <p>{t("livePayments")}: <strong>{runtime.livePaymentsEnabled ? t("enabled") : t("disabled")}</strong></p>
                <p>{t("connectAccounts")}: <strong>{formatKlyxAdminFinanceConnect(locale, connectOk, connectChecks.length)}</strong></p>
              </DiagnosticCard>

              <DiagnosticCard
                title={t("webhookHealth")}
                ready={Boolean(webhook.ready)}
                readyLabel={t("ready")}
                blockedLabel={t("blocked")}
                checks={webhook.checks ?? []}
                locale={locale}
              />
            </section>

            <section className="klyx-card mt-6 p-6">
              <div className="flex gap-3">
                <Banknote className="shrink-0 text-violet-600" size={20} />
                <p className="text-sm leading-7 text-muted-foreground">{t("safetyNote")}</p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function DiagnosticCard({
  title,
  ready,
  readyLabel,
  blockedLabel,
  checks,
  locale,
  children,
}: {
  title: string;
  ready: boolean;
  readyLabel: string;
  blockedLabel: string;
  checks: Check[];
  locale: Parameters<typeof translateKlyxAdminFinanceCheck>[0];
  children?: ReactNode;
}) {
  return (
    <article className="klyx-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${ready ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
          {ready ? readyLabel : blockedLabel}
        </span>
      </div>

      {children && <div className="mt-4 space-y-2 text-sm text-muted-foreground">{children}</div>}

      <div className="mt-5 space-y-2">
        {checks.map((check) => (
          <div key={check.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm">
            <span>{translateKlyxAdminFinanceCheck(locale, check.key)}</span>
            {check.ok ? <CheckCircle2 size={17} className="text-emerald-500" /> : <CircleAlert size={17} className="text-amber-500" />}
          </div>
        ))}
      </div>
    </article>
  );
}
