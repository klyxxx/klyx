// KLYX_PROVIDER_PAYMENTS_UI_CURRENCY_PHASE_5C
"use client";

import FinanceExportButton from "./FinanceExportButton";
import FinanceReconciliationStatus from "./FinanceReconciliationStatus";
import ProviderFinanceAudit from "./ProviderFinanceAudit";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
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
// KLYX_PROVIDER_FINANCE_VISUAL_2026_08_31
// KLYX_PROVIDER_FINANCE_DESTINATION_2026_09_02

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

export default function ProviderPaymentsPage() {
  const [status, setStatus] = useState<StripeStatus>(EMPTY_STATUS);
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY_SUMMARY);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
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
        error instanceof Error
          ? error.message
          : "Impossible d’ouvrir Stripe."
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

  const visibleTransactions = useMemo(
    () => (showAllTransactions ? transactions : transactions.slice(0, 5)),
    [showAllTransactions, transactions]
  );

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-[#2563EB]">
            Finances
          </p>
          <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">
            Ton argent, sans détour.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Montants réellement enregistrés, remboursements et état du compte de paiement.
          </p>
        </header>

        {errorMessage && (
          <section className="mt-6 flex items-start gap-3 border-y border-red-500/30 py-4 text-sm text-red-600 dark:text-red-300">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{errorMessage}</p>
          </section>
        )}

        {loading ? (
          <section className="mt-10 grid min-h-56 place-items-center">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              <LoaderCircle className="animate-spin text-[#2563EB]" size={20} />
              Chargement des finances…
            </div>
          </section>
        ) : (
          <>
            <section className="klyx-card mt-8 overflow-hidden p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Montant prestataire après remboursements
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {money(netAfterRefunds, summary.currency)}
                  </p>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    {readinessTitle}. {readinessDescription}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadAll()}
                  aria-label="Actualiser les finances"
                  title="Actualiser"
                  className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              {!fullyReady && status.connectSetupAllowed && (
                <button
                  type="button"
                  onClick={() => void continueVerification()}
                  disabled={openingStripe}
                  className="klyx-button mt-6 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {openingStripe ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <ExternalLink size={17} />
                  )}
                  {stripeButtonLabel}
                </button>
              )}

              <div className="mt-7 grid border-t border-border sm:grid-cols-3">
                <Metric
                  icon={<WalletCards size={17} />}
                  label="Payé par les clients"
                  value={money(summary.grossPaidCents, summary.currency)}
                  detail={`${summary.successfulPayments} paiement(s) confirmé(s)`}
                />
                <Metric
                  icon={<Banknote size={17} />}
                  label="Commission KLYX"
                  value={money(summary.platformFeeCents, summary.currency)}
                  detail="Commission enregistrée"
                />
                <Metric
                  icon={<RotateCcw size={17} />}
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
                />
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">
                    Transactions récentes
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Paiements et remboursements de tes réservations.
                  </p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="py-10 text-sm text-muted-foreground">
                  Aucune transaction financière pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {visibleTransactions.map((entry) => {
                    const isRefund = entry.entryType.startsWith("refund");
                    const mainAmount = isRefund
                      ? entry.refundAmountCents
                      : entry.grossAmountCents;

                    return (
                      <article
                        key={entry.id}
                        className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {transactionLabel(entry)}
                            </p>
                            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {statusLabel(entry.status)}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateTime(entry.createdAt)} · Réservation{" "}
                            {entry.bookingId.slice(0, 8)}
                          </p>

                          {entry.failureMessage && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                              {entry.failureMessage}
                            </p>
                          )}

                          {!isRefund && entry.status === "succeeded" && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Commission KLYX :{" "}
                              {money(entry.platformFeeCents, entry.currency)} · Prestataire :{" "}
                              {entry.providerAmountCents == null
                                ? "non calculé"
                                : money(
                                    entry.providerAmountCents,
                                    entry.currency
                                  )}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-4 sm:text-right">
                          <p className="text-lg font-semibold">
                            {isRefund ? "−" : ""}
                            {money(mainAmount, entry.currency)}
                          </p>
                          <Link
                            href={`/bookings/${entry.bookingId}`}
                            className="text-sm font-semibold text-[#2563EB]"
                          >
                            Voir
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {transactions.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllTransactions((current) => !current)}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#2563EB]"
                >
                  {showAllTransactions ? "Réduire" : "Voir toutes les transactions"}
                </button>
              )}
            </section>

            <details className="mt-8 border-y border-border py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                <span>Détails du compte de paiement</span>
                <ChevronDown size={17} className="text-muted-foreground" />
              </summary>

              <div className="mt-6 space-y-6">
                <div className="grid gap-2 sm:grid-cols-2">
                  <StatusRow
                    icon={<ShieldCheck size={18} />}
                    title="Compte Stripe"
                    ready={status.connected}
                    readyText="Connecté"
                    waitingText="Non configuré"
                  />
                  <StatusRow
                    icon={<BadgeCheck size={18} />}
                    title="Identité et informations"
                    ready={status.onboardingComplete}
                    readyText="Informations envoyées"
                    waitingText="À compléter ou en examen"
                  />
                  <StatusRow
                    icon={<Banknote size={18} />}
                    title="Paiements Stripe"
                    ready={status.chargesEnabled}
                    readyText="Activés chez Stripe"
                    waitingText="Non activés chez Stripe"
                  />
                  <StatusRow
                    icon={<WalletCards size={18} />}
                    title="Virements Stripe"
                    ready={status.payoutsEnabled}
                    readyText="Activés chez Stripe"
                    waitingText="Non activés chez Stripe"
                  />
                </div>

                <FinanceReconciliationStatus />
                <FinanceExportButton />
                <ProviderFinanceAudit />
              </div>
            </details>
          </>
        )}
      </div>
    </main>
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
  value: string;
  detail: string;
}) {
  return (
    <div className="border-b border-border py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-[#2563EB]">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusRow({
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[#2563EB]">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ready ? readyText : waitingText}
          </p>
        </div>
      </div>

      {ready ? (
        <CheckCircle2 className="shrink-0 text-[#2563EB]" size={18} />
      ) : (
        <XCircle className="shrink-0 text-muted-foreground" size={18} />
      )}
    </div>
  );
}
