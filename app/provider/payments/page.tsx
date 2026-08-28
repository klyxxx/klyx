// KLYX_PROVIDER_PAYMENTS_UI_CURRENCY_PHASE_5C
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  klyxProviderFinanceIntlLocale,
  translateKlyxProviderFinance,
  type KlyxProviderFinanceMessageKey,
  type KlyxProviderFinanceMessageValues,
} from "@/lib/klyx-provider-finance-i18n";
import { createClient } from "@/lib/supabase/client";

import FinanceExportButton from "./FinanceExportButton";
import FinanceReconciliationStatus from "./FinanceReconciliationStatus";
import ProviderFinanceAudit from "./ProviderFinanceAudit";

// KLYX_PROVIDER_LIVE_PAYMENT_READINESS_UI_15_06

type StripeStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string | null;
  runtimeMode?: "test" | "live";
  livePaymentsEnabled?: boolean;
  countryCode?: string;
  marketCommerciallyReady?: boolean;
  marketBlockers?: string[];
  stripeConfigured?: boolean;
  connectSetupAllowed?: boolean;
  livePaymentsOperational?: boolean;
  paymentBlockReason?: string | null;
  error?: string;
};

type FinanceSummary = {
  currency: string;
  grossPaidCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  refundedCents: number;
  refundsProcessingCents: number;
  successfulPayments: number;
  failedPayments: number;
  successfulRefunds: number;
};

type FinanceTransaction = {
  id: string;
  bookingId: string;
  bookingDate: string | null;
  bookingStatus: string | null;
  entryType:
    | "payment_succeeded"
    | "payment_failed"
    | "refund_succeeded"
    | "refund_failed";
  status: "succeeded" | "failed" | "processing";
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number | null;
  refundAmountCents: number;
  paymentMode: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
};

type FinanceResponse = {
  summary?: FinanceSummary;
  transactions?: FinanceTransaction[];
  error?: string;
};

const EMPTY_STATUS: StripeStatus = {
  connected: false,
  onboardingComplete: false,
  chargesEnabled: false,
  payoutsEnabled: false,
};

const EMPTY_SUMMARY: FinanceSummary = {
  currency: "",
  grossPaidCents: 0,
  platformFeeCents: 0,
  providerAmountCents: 0,
  refundedCents: 0,
  refundsProcessingCents: 0,
  successfulPayments: 0,
  failedPayments: 0,
  successfulRefunds: 0,
};

function money(cents: number, currency: string, intlLocale: string) {
  const code = currency?.trim().toUpperCase();

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

function dateTime(value: string, intlLocale: string) {
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProviderPaymentsPage() {
  const { locale } = useKlyxLocale();
  const intlLocale = klyxProviderFinanceIntlLocale(locale);
  const t = (
    key: KlyxProviderFinanceMessageKey,
    values: KlyxProviderFinanceMessageValues = {}
  ) => translateKlyxProviderFinance(locale, key, values);

  const [status, setStatus] = useState<StripeStatus>(EMPTY_STATUS);
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY_SUMMARY);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function transactionLabel(entry: FinanceTransaction) {
    if (entry.entryType === "payment_succeeded") return t("paymentReceived");
    if (entry.entryType === "payment_failed") return t("paymentDeclined");
    if (
      entry.entryType === "refund_succeeded" &&
      entry.status === "processing"
    ) {
      return t("refundProcessingLabel");
    }
    if (entry.entryType === "refund_succeeded") return t("refundConfirmed");
    return t("refundFailed");
  }

  function statusLabel(entryStatus: FinanceTransaction["status"]) {
    if (entryStatus === "succeeded") return t("statusConfirmed");
    if (entryStatus === "processing") return t("statusProcessing");
    return t("statusFailed");
  }

  async function getAccessToken(): Promise<string> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("KLYX_AUTH_REQUIRED");
    }

    return session.access_token;
  }

  async function loadAll() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [stripeResponse, financeResponse] = await Promise.all([
        fetch("/api/stripe/connect/status", {
          method: "GET",
          cache: "no-store",
          headers,
        }),
        fetch("/api/provider/finance", {
          method: "GET",
          cache: "no-store",
          headers,
        }),
      ]);

      const stripeResult = (await stripeResponse.json()) as StripeStatus;
      const financeResult = (await financeResponse.json()) as FinanceResponse;

      if (!stripeResponse.ok || !financeResponse.ok) {
        throw new Error("KLYX_PROVIDER_FINANCE_LOAD_FAILED");
      }

      setStatus(stripeResult);
      setSummary(financeResult.summary ?? EMPTY_SUMMARY);
      setTransactions(financeResult.transactions ?? []);
    } catch {
      setErrorMessage(t("genericLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // Locale changes intentionally re-render formatting/copy without refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function continueVerification() {
    setOpeningStripe(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error("KLYX_STRIPE_CONNECT_OPEN_FAILED");
      }

      window.location.assign(result.url);
    } catch {
      setErrorMessage(t("genericStripeOpenError"));
      setOpeningStripe(false);
    }
  }

  const fullyReady = Boolean(status.livePaymentsOperational);
  const stripeConfigured = Boolean(status.stripeConfigured);
  const testMode = status.runtimeMode === "test";
  const livePaymentsDisabled =
    status.runtimeMode === "live" && status.livePaymentsEnabled === false;
  const marketBlocked =
    status.runtimeMode === "live" &&
    status.livePaymentsEnabled !== false &&
    status.marketCommerciallyReady === false;

  const readinessTitle = fullyReady
    ? t("readinessReadyTitle")
    : testMode
      ? stripeConfigured
        ? t("readinessTestReadyTitle")
        : t("readinessTestSetupTitle")
      : livePaymentsDisabled
        ? t("readinessLiveDisabledTitle")
        : marketBlocked
          ? t("readinessMarketBlockedTitle")
          : status.connected
            ? t("readinessVerificationTitle")
            : t("readinessSetupTitle");

  const readinessDescription = fullyReady
    ? t("readinessReadyDescription")
    : testMode
      ? t("readinessTestDescription")
      : livePaymentsDisabled
        ? t("readinessLiveDisabledDescription")
        : marketBlocked
          ? status.countryCode
            ? t("readinessMarketBlockedCountry", {
                country: status.countryCode,
              })
            : t("readinessMarketBlockedGeneric")
          : t("readinessVerificationDescription");

  const stripeButtonLabel = testMode
    ? stripeConfigured
      ? t("stripeManageTest")
      : status.connected
        ? t("stripeContinueTest")
        : t("stripeConfigureTest")
    : status.connected
      ? t("stripeContinueVerification")
      : t("stripeConfigurePayments");

  const netAfterRefunds = Math.max(
    summary.providerAmountCents - summary.refundedCents,
    0
  );

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/provider"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("backProvider")}
        </Link>

        <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]">
            <WalletCards size={15} />
            {t("pageEyebrow")}
          </div>

          {/* KLYX_AI_FIRST_PROVIDER_FINANCE_15_04 */}
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("pageTitle")}
          </h1>
        </section>

        {errorMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            {errorMessage}
          </div>
        )}

        {loading ? (
          <section className="klyx-card mt-8 grid min-h-56 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" size={38} />
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MoneyCard
                icon={<TrendingUp size={21} />}
                title={t("paidByClients")}
                value={money(summary.grossPaidCents, summary.currency, intlLocale)}
                detail={t("confirmedPayments", {
                  count: summary.successfulPayments,
                })}
              />
              <MoneyCard
                icon={<Banknote size={21} />}
                title={t("platformFee")}
                value={money(summary.platformFeeCents, summary.currency, intlLocale)}
                detail={t("platformFeeRecorded")}
              />
              <MoneyCard
                icon={<WalletCards size={21} />}
                title={t("providerAmount")}
                value={money(summary.providerAmountCents, summary.currency, intlLocale)}
                detail={t("beforeRefunds")}
              />
              <MoneyCard
                icon={<RotateCcw size={21} />}
                title={t("refunded")}
                value={money(summary.refundedCents, summary.currency, intlLocale)}
                detail={
                  summary.refundsProcessingCents > 0
                    ? t("refundProcessing", {
                        amount: money(
                          summary.refundsProcessingCents,
                          summary.currency,
                          intlLocale
                        ),
                      })
                    : t("refundCount", { count: summary.successfulRefunds })
                }
              />
            </section>

            <section className="klyx-card mt-6 p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                    {t("financialSituation")}
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {t("afterRefunds", {
                      amount: money(netAfterRefunds, summary.currency, intlLocale),
                    })}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("canonicalJournal")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-bold transition hover:bg-muted"
                >
                  <RefreshCw size={17} />
                  {t("refresh")}
                </button>
              </div>
            </section>

            <section
              className={`mt-6 rounded-3xl border p-6 ${
                fullyReady
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-amber-500/25 bg-amber-500/10"
              }`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-foreground dark:text-white ${
                      fullyReady ? "bg-emerald-600" : "bg-amber-500"
                    }`}
                  >
                    {fullyReady ? <BadgeCheck /> : <Clock3 />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black">{readinessTitle}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {readinessDescription}
                    </p>
                  </div>
                </div>

                {!fullyReady && status.connectSetupAllowed && (
                  <button
                    type="button"
                    onClick={() => void continueVerification()}
                    disabled={openingStripe}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-60"
                  >
                    {openingStripe ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : (
                      <ExternalLink size={18} />
                    )}
                    {stripeButtonLabel}
                  </button>
                )}
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatusCard
                icon={<ShieldCheck size={20} />}
                title={t("stripeAccount")}
                ready={status.connected}
                readyText={t("connected")}
                waitingText={t("notConfigured")}
              />
              <StatusCard
                icon={<BadgeCheck size={20} />}
                title={t("identityInformation")}
                ready={status.onboardingComplete}
                readyText={t("informationSubmitted")}
                waitingText={t("informationReview")}
              />
              <StatusCard
                icon={<Banknote size={20} />}
                title={t("stripePayments")}
                ready={status.chargesEnabled}
                readyText={t("enabledAtStripe")}
                waitingText={t("disabledAtStripe")}
              />
              <StatusCard
                icon={<WalletCards size={20} />}
                title={t("stripePayouts")}
                ready={status.payoutsEnabled}
                readyText={t("enabledAtStripe")}
                waitingText={t("disabledAtStripe")}
              />
            </section>

            {/* KLYX_GROUP_FINANCE_AUDIT_PAGE_13_03 */}
            {/* KLYX_FINANCE_RECONCILIATION_PAGE_13_13 */}
            <FinanceReconciliationStatus />

            {/* KLYX_CANONICAL_FINANCE_EXPORT_PAGE_13_14 */}
            <FinanceExportButton />

            <ProviderFinanceAudit />

            <section className="klyx-card mt-6 overflow-hidden">
              <div className="border-b border-border p-6">
                <h2 className="text-xl font-black">{t("recentTransactions")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("recentTransactionsDescription")}
                </p>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t("noTransactions")}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {transactions.map((entry) => {
                    const isRefund = entry.entryType.startsWith("refund");
                    const mainAmount = isRefund
                      ? entry.refundAmountCents
                      : entry.grossAmountCents;
                    const hasFailureDetail = Boolean(
                      entry.failureCode || entry.failureMessage
                    );

                    return (
                      <article
                        key={entry.id}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{transactionLabel(entry)}</p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-black ${
                                entry.status === "succeeded"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : entry.status === "processing"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {statusLabel(entry.status)}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateTime(entry.createdAt, intlLocale)}
                            {" · "}
                            {t("bookingShort", {
                              id: entry.bookingId.slice(0, 8),
                            })}
                          </p>

                          {hasFailureDetail && entry.status === "failed" && (
                            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                              {t("genericTransactionFailure")}
                            </p>
                          )}

                          {!isRefund && entry.status === "succeeded" && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t("platformFee")}: {money(
                                entry.platformFeeCents,
                                entry.currency,
                                intlLocale
                              )}
                              {" · "}
                              {t("providerShare")}: {entry.providerAmountCents == null
                                ? t("notCalculated")
                                : money(
                                    entry.providerAmountCents,
                                    entry.currency,
                                    intlLocale
                                  )}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 sm:text-right">
                          <p
                            className={`text-lg font-black ${
                              isRefund
                                ? "text-amber-600 dark:text-amber-400"
                                : entry.status === "failed"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {isRefund ? "−" : ""}
                            {money(mainAmount, entry.currency, intlLocale)}
                          </p>

                          <Link
                            href={`/bookings/${entry.bookingId}`}
                            className="text-sm font-black text-violet-600 dark:text-violet-400"
                          >
                            {t("view")}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MoneyCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="klyx-card p-5">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
        {icon}
      </span>
      <p className="mt-5 text-sm font-bold text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function StatusCard({
  icon,
  title,
  ready,
  readyText,
  waitingText,
}: {
  icon: ReactNode;
  title: string;
  ready: boolean;
  readyText: string;
  waitingText: string;
}) {
  return (
    <article className="klyx-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            {icon}
          </span>
          <div>
            <p className="font-black">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ready ? readyText : waitingText}
            </p>
          </div>
        </div>
        {ready ? (
          <CheckCircle2 className="text-emerald-500" size={21} />
        ) : (
          <XCircle className="text-amber-500" size={21} />
        )}
      </div>
    </article>
  );
}
