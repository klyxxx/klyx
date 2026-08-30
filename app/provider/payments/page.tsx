// KLYX_PROVIDER_PAYMENTS_UI_CURRENCY_PHASE_5C
"use client";

import FinanceExportButton from "./FinanceExportButton";
import FinanceReconciliationStatus from "./FinanceReconciliationStatus";
import ProviderFinanceAudit from "./ProviderFinanceAudit";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

function money(cents: number, currency: string) {
  const code = currency?.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    return (cents / 100).toFixed(2);
  }

  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function transactionLabel(entry: FinanceTransaction) {
  if (entry.entryType === "payment_succeeded") return "Paiement reçu";
  if (entry.entryType === "payment_failed") return "Paiement refusé";

  if (
    entry.entryType === "refund_succeeded" &&
    entry.status === "processing"
  ) {
    return "Remboursement en cours";
  }

  if (entry.entryType === "refund_succeeded") {
    return "Remboursement confirmé";
  }

  return "Remboursement échoué";
}

function statusLabel(status: FinanceTransaction["status"]) {
  if (status === "succeeded") return "Confirmé";
  if (status === "processing") return "En cours";
  return "Échec";
}

function transactionStatusClass(status: FinanceTransaction["status"]) {
  if (status === "succeeded") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "processing") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return "bg-red-500/10 text-red-700 dark:text-red-300";
}

export default function ProviderPaymentsPage() {
  const [status, setStatus] = useState<StripeStatus>(EMPTY_STATUS);
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY_SUMMARY);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function getAccessToken(): Promise<string> {
    const supabase = createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw new Error(error.message);

    if (!session?.access_token) {
      throw new Error("Session manquante. Reconnecte-toi puis réessaie.");
    }

    return session.access_token;
  }

  async function loadAll() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

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

      if (!stripeResponse.ok) {
        throw new Error(
          stripeResult.error || "Impossible de vérifier le compte Stripe."
        );
      }

      if (!financeResponse.ok) {
        throw new Error(
          financeResult.error || "Impossible de charger les finances."
        );
      }

      setStatus(stripeResult);
      setSummary(financeResult.summary ?? EMPTY_SUMMARY);
      setTransactions(financeResult.transactions ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les paiements."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function continueVerification() {
    setOpeningStripe(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error(
          result.error || "Impossible d’ouvrir la vérification Stripe."
        );
      }

      window.location.assign(result.url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d’ouvrir Stripe."
      );
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
    ? "Compte prêt à recevoir des paiements"
    : testMode
      ? stripeConfigured
        ? "Stripe configuré en mode test"
        : "Configuration Stripe de test"
      : livePaymentsDisabled
        ? "Paiements réels KLYX désactivés"
        : marketBlocked
          ? "Paiements réels pas encore ouverts dans ce pays"
          : status.connected
            ? "Vérification Stripe à terminer"
            : "Compte Stripe à configurer";

  const readinessDescription = fullyReady
    ? "Paiements et virements réels activés."
    : testMode
      ? "Cette configuration sert aux tests KLYX. Elle ne signifie pas que les paiements réels sont ouverts."
      : livePaymentsDisabled
        ? "KLYX garde les paiements réels fermés pour le moment."
        : marketBlocked
          ? `Stripe peut être configuré, mais KLYX n'a pas encore ouvert commercialement les paiements réels${
              status.countryCode ? ` en ${status.countryCode}` : " dans ce pays"
            }.`
          : "Ouvre Stripe pour corriger ou compléter les informations demandées.";

  const stripeButtonLabel = testMode
    ? stripeConfigured
      ? "Gérer Stripe test"
      : status.connected
        ? "Continuer Stripe test"
        : "Configurer Stripe test"
    : status.connected
      ? "Continuer la vérification"
      : "Configurer les paiements";

  const netAfterRefunds = Math.max(
    summary.providerAmountCents - summary.refundedCents,
    0
  );

  const paymentChecks = [
    {
      title: "Compte Stripe",
      ready: status.connected,
      readyText: "Connecté",
      waitingText: "Non configuré",
      icon: ShieldCheck,
    },
    {
      title: "Identité et informations",
      ready: status.onboardingComplete,
      readyText: "Informations envoyées",
      waitingText: "À compléter ou en examen",
      icon: BadgeCheck,
    },
    {
      title: "Paiements Stripe",
      ready: status.chargesEnabled,
      readyText: "Activés chez Stripe",
      waitingText: "Non activés chez Stripe",
      icon: Banknote,
    },
    {
      title: "Virements Stripe",
      ready: status.payoutsEnabled,
      readyText: "Activés chez Stripe",
      waitingText: "Non activés chez Stripe",
      icon: WalletCards,
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/provider"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Espace prestataire
        </Link>

        <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <WalletCards size={17} />
              <span>Finances</span>
            </div>

            {/* KLYX_AI_FIRST_PROVIDER_FINANCE_15_04 */}
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              Mes finances KLYX
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              Ce que tu as réellement reçu, les remboursements et les transactions associées à tes missions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </header>

        {errorMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle className="animate-spin text-blue-600" size={34} />
          </div>
        ) : (
          <>
            <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="p-5 sm:p-7">
                <p className="text-sm font-medium text-muted-foreground">
                  Montant prestataire après remboursements
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  {money(netAfterRefunds, summary.currency)}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Journal KLYX · paiements traités par Stripe.
                </p>
              </div>

              <div className="grid border-t border-border sm:grid-cols-3">
                <FinanceFact
                  label="Payé par les clients"
                  value={money(summary.grossPaidCents, summary.currency)}
                  detail={`${summary.successfulPayments} paiement(s) confirmé(s)`}
                />
                <FinanceFact
                  label="Commission KLYX"
                  value={money(summary.platformFeeCents, summary.currency)}
                  detail="Commission enregistrée"
                  bordered
                />
                <FinanceFact
                  label="Remboursé"
                  value={money(summary.refundedCents, summary.currency)}
                  detail={
                    summary.refundsProcessingCents > 0
                      ? `${money(
                          summary.refundsProcessingCents,
                          summary.currency
                        )} en cours`
                      : `${summary.successfulRefunds} remboursement(s)`
                  }
                  bordered
                />
              </div>
            </section>

            {!fullyReady && (
              <section className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      <Clock3 size={19} />
                    </span>
                    <div>
                      <h2 className="font-semibold">{readinessTitle}</h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {readinessDescription}
                      </p>
                    </div>
                  </div>

                  {status.connectSetupAllowed && (
                    <button
                      type="button"
                      onClick={() => void continueVerification()}
                      disabled={openingStripe}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {openingStripe ? (
                        <LoaderCircle size={17} className="animate-spin" />
                      ) : (
                        <ExternalLink size={17} />
                      )}
                      {stripeButtonLabel}
                    </button>
                  )}
                </div>
              </section>
            )}

            {fullyReady && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm">
                <CheckCircle2 className="shrink-0 text-emerald-600" size={19} />
                <div>
                  <p className="font-semibold">{readinessTitle}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {readinessDescription}
                  </p>
                </div>
              </div>
            )}

            <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-5 sm:p-6">
                <h2 className="text-xl font-semibold">Transactions récentes</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Paiements et remboursements de tes réservations.
                </p>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aucune transaction financière pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {transactions.map((entry) => {
                    const isRefund = entry.entryType.startsWith("refund");
                    const mainAmount = isRefund
                      ? entry.refundAmountCents
                      : entry.grossAmountCents;

                    return (
                      <article
                        key={entry.id}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {transactionLabel(entry)}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${transactionStatusClass(
                                entry.status
                              )}`}
                            >
                              {statusLabel(entry.status)}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateTime(entry.createdAt)} · Réservation{" "}
                            {entry.bookingId.slice(0, 8)}
                          </p>

                          {entry.failureMessage && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                              {entry.failureMessage}
                            </p>
                          )}

                          {!isRefund && entry.status === "succeeded" && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Commission KLYX:{" "}
                              {money(entry.platformFeeCents, entry.currency)} · Prestataire:{" "}
                              {entry.providerAmountCents == null
                                ? "non calculé"
                                : money(
                                    entry.providerAmountCents,
                                    entry.currency
                                  )}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 sm:text-right">
                          <p
                            className={`text-lg font-semibold ${
                              isRefund
                                ? "text-amber-700 dark:text-amber-300"
                                : entry.status === "failed"
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {isRefund ? "−" : ""}
                            {money(mainAmount, entry.currency)}
                          </p>

                          <Link
                            href={`/bookings/${entry.bookingId}`}
                            className="text-sm font-semibold text-blue-600 dark:text-blue-400"
                          >
                            Voir
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <details className="group mt-6 rounded-2xl border border-border bg-card shadow-sm">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold marker:hidden sm:px-6">
                <span>État du compte et contrôles avancés</span>
                <ChevronDown
                  size={18}
                  className="text-muted-foreground transition group-open:rotate-180"
                />
              </summary>

              <div className="border-t border-border p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {paymentChecks.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600/8 text-blue-600 dark:text-blue-400">
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.ready ? item.readyText : item.waitingText}
                          </p>
                        </div>
                        {item.ready ? (
                          <CheckCircle2
                            className="shrink-0 text-emerald-500"
                            size={18}
                          />
                        ) : (
                          <XCircle
                            className="shrink-0 text-amber-500"
                            size={18}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* KLYX_GROUP_FINANCE_AUDIT_PAGE_13_03 */}
                {/* KLYX_FINANCE_RECONCILIATION_PAGE_13_13 */}
                <FinanceReconciliationStatus />

                {/* KLYX_CANONICAL_FINANCE_EXPORT_PAGE_13_14 */}
                <FinanceExportButton />

                <ProviderFinanceAudit />
              </div>
            </details>

            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <RotateCcw size={14} />
              Les remboursements en cours restent distingués des montants confirmés.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function FinanceFact({
  label,
  value,
  detail,
  bordered = false,
}: {
  label: string;
  value: string;
  detail: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`p-5 sm:p-6 ${
        bordered ? "border-t border-border sm:border-l sm:border-t-0" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
