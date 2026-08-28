"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  klyxProviderFinanceIntlLocale,
  translateKlyxProviderFinance,
  type KlyxProviderFinanceMessageKey,
  type KlyxProviderFinanceMessageValues,
} from "@/lib/klyx-provider-finance-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_FINANCE_RECONCILIATION_UI_13_13

type DifferenceKey =
  | "grossPaidCents"
  | "platformFeeCents"
  | "providerAmountCents"
  | "refundedCents"
  | "refundsProcessingCents";

type DifferenceMap = Record<DifferenceKey, number>;

type Reconciliation = {
  checked: boolean;
  reconciled: boolean;
  status: "ok" | "review_required" | string;
  source: string;
  differenceCents: DifferenceMap;
  commercialEventsChecked: number;
  commercialEventsReturned: number;
  historyTruncatedForDisplay: boolean;
  readOnly: boolean;
  ledgerModified: boolean;
  stripeModified: boolean;
  automaticCorrection: boolean;
};

type FinanceResponse = {
  reconciliation?: Reconciliation;
  summary?: {
    currency?: string;
  };
  error?: string;
};

function formatDifference(
  cents: number,
  currency: string,
  intlLocale: string
): string {
  const code = /^[A-Z]{3}$/.test(currency.trim().toUpperCase())
    ? currency.trim().toUpperCase()
    : "EUR";

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: code,
    signDisplay: "exceptZero",
  }).format(cents / 100);
}

export default function FinanceReconciliationStatus() {
  const { locale } = useKlyxLocale();
  const intlLocale = klyxProviderFinanceIntlLocale(locale);
  const t = useCallback(
    (
      key: KlyxProviderFinanceMessageKey,
      values: KlyxProviderFinanceMessageValues = {}
    ) => translateKlyxProviderFinance(locale, key, values),
    [locale]
  );

  const [data, setData] = useState<Reconciliation | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error("KLYX_AUTH_REQUIRED");
        }

        const response = await fetch("/api/provider/finance", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const body = (await response.json()) as FinanceResponse;

        if (!response.ok || !body.reconciliation) {
          throw new Error("KLYX_FINANCE_RECONCILIATION_FAILED");
        }

        const responseCurrency = body.summary?.currency?.trim().toUpperCase();
        if (responseCurrency && /^[A-Z]{3}$/.test(responseCurrency)) {
          setCurrency(responseCurrency);
        }
        setData(body.reconciliation);
      } catch {
        setData(null);
        setErrorMessage(t("genericReconciliationError"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const differenceLabels: Record<DifferenceKey, string> = {
    grossPaidCents: t("reconciliationGross"),
    platformFeeCents: t("reconciliationFee"),
    providerAmountCents: t("reconciliationProvider"),
    refundedCents: t("reconciliationRefunds"),
    refundsProcessingCents: t("reconciliationRefundsProcessing"),
  };

  if (loading) {
    return (
      <section className="klyx-card mt-6 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <LoaderCircle className="animate-spin text-violet-600" size={22} />
          <div>
            <p className="font-black">{t("reconciliationLoadingTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reconciliationLoadingDescription")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (errorMessage || !data) {
    return (
      <section className="mt-6 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-amber-600"
            size={24}
          />
          <div className="flex-1">
            <p className="font-black text-amber-800 dark:text-amber-200">
              {t("reconciliationUnavailable")}
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
              {errorMessage || t("reconciliationUnavailableDescription")}
            </p>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-amber-500/25 bg-background px-4 text-sm font-black disabled:opacity-50"
            >
              {refreshing ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              {t("retry")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const differences = (
    Object.entries(data.differenceCents) as Array<[DifferenceKey, number]>
  ).filter(([, value]) => value !== 0);

  if (data.reconciled) {
    return (
      <section className="mt-6 rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                {t("reconciliationEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-black">
                {t("reconciliationHealthyTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("reconciliationHealthyDescription")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-emerald-500/25 bg-background px-4 text-sm font-black disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            {t("verify")}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              {t("checkedEvents")}
            </p>
            <p className="mt-1 text-2xl font-black">
              {data.commercialEventsChecked}
            </p>
          </article>
          <article className="rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              {t("difference")}
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-600">
              {formatDifference(0, currency, intlLocale)}
            </p>
          </article>
          <article className="rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              {t("automaticCorrection")}
            </p>
            <p className="mt-1 text-sm font-black">{t("disabled")}</p>
          </article>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
          <ShieldCheck
            className="mt-0.5 shrink-0 text-emerald-600"
            size={18}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {t("reconciliationReadOnly")}
            {data.historyTruncatedForDisplay
              ? ` ${t("reconciliationHistoryChecked")}`
              : ""}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-[2rem] border border-rose-500/25 bg-rose-500/10 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
              {t("reconciliationEyebrow")}
            </p>
            <h2 className="mt-2 text-xl font-black">
              {t("reconciliationReviewTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("reconciliationReviewDescription")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-rose-500/25 bg-background px-4 text-sm font-black disabled:opacity-50"
        >
          {refreshing ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          {t("reverify")}
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {differences.length === 0 ? (
          <article className="rounded-2xl border border-rose-500/15 bg-background/70 p-4">
            <p className="text-sm font-bold">
              {t("reconciliationStructuralMismatch")}
            </p>
          </article>
        ) : (
          differences.map(([key, value]) => (
            <article
              key={key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-rose-500/15 bg-background/70 p-4"
            >
              <p className="text-sm font-bold">{differenceLabels[key]}</p>
              <p className="font-black text-rose-600 dark:text-rose-300">
                {formatDifference(value, currency, intlLocale)}
              </p>
            </article>
          ))
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
        <ShieldCheck className="mt-0.5 shrink-0 text-rose-600" size={18} />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("reconciliationDiagnostic")}
        </p>
      </div>
    </section>
  );
}
