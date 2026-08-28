"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
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
import { createClient } from "@/lib/supabase/client";

// KLYX_GROUP_FINANCE_AUDIT_UI_13_03
// KLYX_PROVIDER_STRIPE_FINANCIAL_VISIBILITY_UI_16_07

type FinanceAudit = {
  auditVersion: string;
  readOnly: boolean;
  healthy: boolean;
  summary: {
    bookingCount: number;
    bookingGroupCount: number;
    ledgerRowCount: number;
    groupedLedgerRowCount: number;
    distinctGroupPaymentIntents: number;
    distinctGroupRefunds: number;
    duplicatedStripeEvents: number;
    suspiciousPaymentEvents: number;
    suspiciousRefundEvents: number;
  };
  automaticExecutionAllowed: false;
};

type StripeAmount = {
  amountCents: number;
  currency: string;
};

type StripePayout = StripeAmount & {
  status: string;
  arrivalDate: string | null;
  createdAt: string;
  failureCode: string | null;
  failureMessage: string | null;
};

type StripeFinancialStatus = {
  connected: boolean;
  defaultCurrency: string;
  available: StripeAmount[];
  pending: StripeAmount[];
  payouts: StripePayout[];
  error?: string;
};

function money(cents: number, currency: string, intlLocale: string) {
  const code = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}

function amountsLabel(
  amounts: StripeAmount[],
  fallbackCurrency: string,
  intlLocale: string
) {
  if (amounts.length === 0) {
    return money(0, fallbackCurrency || "eur", intlLocale);
  }

  return amounts
    .map((entry) => money(entry.amountCents, entry.currency, intlLocale))
    .join(" · ");
}

export default function ProviderFinanceAudit() {
  const { locale } = useKlyxLocale();
  const intlLocale = klyxProviderFinanceIntlLocale(locale);
  const t = useCallback(
    (
      key: KlyxProviderFinanceMessageKey,
      values: KlyxProviderFinanceMessageValues = {}
    ) => translateKlyxProviderFinance(locale, key, values),
    [locale]
  );

  const [audit, setAudit] = useState<FinanceAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [stripeFinance, setStripeFinance] =
    useState<StripeFinancialStatus | null>(null);
  const [stripeFinanceLoading, setStripeFinanceLoading] = useState(true);
  const [stripeFinanceError, setStripeFinanceError] = useState("");

  function dateLabel(value: string | null) {
    if (!value) return t("dateUnavailable");

    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "medium",
    }).format(new Date(value));
  }

  function payoutStatusLabel(status: string) {
    if (status === "paid") return t("payoutPaid");
    if (status === "in_transit") return t("payoutTransit");
    if (status === "pending") return t("payoutPending");
    if (status === "failed") return t("payoutFailed");
    if (status === "canceled") return t("payoutCanceled");
    return status;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setStripeFinanceLoading(true);
    setErrorMessage("");
    setStripeFinanceError("");

    let stripeFinanceResolved = false;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("KLYX_AUTH_REQUIRED");
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [auditResponse, stripeResponse] = await Promise.all([
        fetch("/api/provider/finance-audit", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/stripe/connect/financial-status", {
          cache: "no-store",
          headers,
        }),
      ]);

      const auditBody = (await auditResponse.json()) as FinanceAudit & {
        error?: string;
      };

      let stripeBody: StripeFinancialStatus | null = null;
      try {
        stripeBody = (await stripeResponse.json()) as StripeFinancialStatus;
      } catch {
        stripeBody = null;
      }

      if (stripeResponse.ok && stripeBody) {
        stripeFinanceResolved = true;
        setStripeFinance(stripeBody);
      } else {
        setStripeFinance(null);
        setStripeFinanceError(t("genericStripeBalanceError"));
      }

      if (!auditResponse.ok) {
        throw new Error("KLYX_PROVIDER_FINANCE_AUDIT_FAILED");
      }

      setAudit(auditBody);
    } catch {
      setAudit(null);
      setErrorMessage(t("genericAuditError"));

      if (!stripeFinanceResolved) {
        setStripeFinanceError((current) =>
          current || t("genericStripeBalanceError")
        );
      }
    } finally {
      setLoading(false);
      setStripeFinanceLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestPayout = stripeFinance?.payouts?.[0] ?? null;
  const latestPayoutFailed = Boolean(
    latestPayout &&
      (latestPayout.status === "failed" ||
        latestPayout.failureCode ||
        latestPayout.failureMessage)
  );

  return (
    <section className="klyx-card mt-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ShieldCheck size={21} />
          </div>
          <div>
            <p className="klyx-eyebrow">{t("auditEyebrow")}</p>
            <h2 className="mt-1 text-xl font-black">{t("auditTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("auditDescription")}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || stripeFinanceLoading}
          onClick={() => void load()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-black transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={loading || stripeFinanceLoading ? "animate-spin" : ""}
          />
          {t("refresh")}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Banknote size={19} />
          </div>
          <div>
            <p className="font-black">{t("stripeBalanceTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("stripeBalanceDescription")}
            </p>
          </div>
        </div>

        {stripeFinanceLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={17} />
            {t("stripeBalanceLoading")}
          </div>
        ) : stripeFinanceError ? (
          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {stripeFinanceError}
          </div>
        ) : !stripeFinance?.connected ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("stripeBalanceConfigure")}
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StripeMetric
                label={t("availableBalance")}
                value={amountsLabel(
                  stripeFinance.available,
                  stripeFinance.defaultCurrency,
                  intlLocale
                )}
                detail={t("availableBalanceDetail")}
              />
              <StripeMetric
                label={t("pendingBalance")}
                value={amountsLabel(
                  stripeFinance.pending,
                  stripeFinance.defaultCurrency,
                  intlLocale
                )}
                detail={t("pendingBalanceDetail")}
              />
            </div>

            <div className="mt-3 rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Clock3
                  size={18}
                  className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400"
                />
                <div className="min-w-0">
                  <p className="text-sm font-black">{t("latestPayout")}</p>
                  {latestPayout ? (
                    <>
                      <p className="mt-1 text-sm">
                        {money(
                          latestPayout.amountCents,
                          latestPayout.currency,
                          intlLocale
                        )}{" "}
                        · {payoutStatusLabel(latestPayout.status)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("expectedArrival", {
                          date: dateLabel(latestPayout.arrivalDate),
                        })}
                      </p>
                      {latestPayoutFailed ? (
                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                          {t("genericPayoutFailure")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("noPayout")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {loading && !audit ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" size={17} />
          {t("ledgerAnalysis")}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      ) : null}

      {audit ? (
        <>
          <div
            className={
              "mt-5 rounded-2xl border p-4 " +
              (audit.healthy
                ? "border-emerald-500/25 bg-emerald-500/10"
                : "border-amber-500/25 bg-amber-500/10")
            }
          >
            <div className="flex items-start gap-3">
              {audit.healthy ? (
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
              ) : (
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
              )}
              <div>
                <p className="font-black">
                  {audit.healthy ? t("auditHealthy") : t("auditReview")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("auditReadOnly")}
                </p>
              </div>
            </div>
          </div>

          {/* KLYX_GROUP_FINANCE_AUDIT_METRICS_13_03 */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              label={t("groupedMissions")}
              value={audit.summary.bookingGroupCount}
            />
            <Metric
              label={t("groupedStripePayments")}
              value={audit.summary.distinctGroupPaymentIntents}
            />
            <Metric
              label={t("groupedRefunds")}
              value={audit.summary.distinctGroupRefunds}
            />
            <Metric
              label={t("suspiciousAnomalies")}
              value={
                audit.summary.suspiciousPaymentEvents +
                audit.summary.suspiciousRefundEvents
              }
            />
          </div>

          {audit.summary.duplicatedStripeEvents > 0 ? (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {t("duplicatedStripeEvents", {
                count: audit.summary.duplicatedStripeEvents,
              })}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function StripeMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
