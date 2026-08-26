"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

function money(cents: number, currency: string) {
  const code = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    return (cents / 100).toFixed(2);
  }

  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}

function amountsLabel(amounts: StripeAmount[], fallbackCurrency: string) {
  if (amounts.length === 0) {
    return money(0, fallbackCurrency || "eur");
  }

  return amounts
    .map((entry) => money(entry.amountCents, entry.currency))
    .join(" · ");
}

function dateLabel(value: string | null) {
  if (!value) return "Date non disponible";

  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function payoutStatusLabel(status: string) {
  if (status === "paid") return "Versé";
  if (status === "in_transit") return "En route";
  if (status === "pending") return "En attente";
  if (status === "failed") return "Échec";
  if (status === "canceled") return "Annulé";
  return status;
}

export default function ProviderFinanceAudit() {
  const [audit, setAudit] = useState<FinanceAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [stripeFinance, setStripeFinance] =
    useState<StripeFinancialStatus | null>(null);
  const [stripeFinanceLoading, setStripeFinanceLoading] = useState(true);
  const [stripeFinanceError, setStripeFinanceError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setStripeFinanceLoading(true);
    setErrorMessage("");
    setStripeFinanceError("");

    try {
      const supabase = createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        throw new Error("Session KLYX manquante.");
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
        setStripeFinance(stripeBody);
      } else {
        setStripeFinance(null);
        setStripeFinanceError(
          stripeBody?.error || "Solde Stripe temporairement indisponible."
        );
      }

      if (!auditResponse.ok) {
        throw new Error(
          auditBody.error || "Audit financier indisponible."
        );
      }

      setAudit(auditBody);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Audit financier indisponible.";

      setErrorMessage(message);
      setStripeFinanceError((current) => current || message);
    } finally {
      setLoading(false);
      setStripeFinanceLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latestPayout = stripeFinance?.payouts?.[0] ?? null;

  return (
    <section className="klyx-card mt-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ShieldCheck size={21} />
          </div>

          <div>
            <p className="klyx-eyebrow">KLYX Finance</p>

            <h2 className="mt-1 text-xl font-black">
              Audit paiements groupés
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              KLYX vérifie que plusieurs créneaux d’une même mission ne créent
              pas artificiellement plusieurs événements financiers.
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
          Actualiser
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Banknote size={19} />
          </div>

          <div>
            <p className="font-black">Solde Stripe Connect</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              KLYX affiche ici le solde réel du compte prestataire et ses
              derniers virements, sans exposer ses coordonnées bancaires.
            </p>
          </div>
        </div>

        {stripeFinanceLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={17} />
            Lecture du solde Stripe...
          </div>
        ) : stripeFinanceError ? (
          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {stripeFinanceError}
          </div>
        ) : !stripeFinance?.connected ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Configure ton compte de paiement pour afficher ton solde et tes
            virements ici.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StripeMetric
                label="Solde disponible"
                value={amountsLabel(
                  stripeFinance.available,
                  stripeFinance.defaultCurrency
                )}
                detail="Montant actuellement disponible chez Stripe"
              />

              <StripeMetric
                label="En attente"
                value={amountsLabel(
                  stripeFinance.pending,
                  stripeFinance.defaultCurrency
                )}
                detail="Paiements encore en cours de disponibilité"
              />
            </div>

            <div className="mt-3 rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Clock3
                  size={18}
                  className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400"
                />

                <div className="min-w-0">
                  <p className="text-sm font-black">Dernier virement</p>

                  {latestPayout ? (
                    <>
                      <p className="mt-1 text-sm">
                        {money(latestPayout.amountCents, latestPayout.currency)} ·{" "}
                        {payoutStatusLabel(latestPayout.status)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Arrivée prévue : {dateLabel(latestPayout.arrivalDate)}
                      </p>
                      {latestPayout.failureMessage ? (
                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                          {latestPayout.failureMessage}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aucun virement Stripe enregistré pour le moment.
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
          Analyse du ledger...
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
                  {audit.healthy
                    ? "Aucun double comptage suspect détecté"
                    : "Une incohérence financière potentielle doit être vérifiée"}
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Audit 13.03 en lecture seule. Aucun paiement, remboursement ou
                  montant n’est corrigé automatiquement.
                </p>
              </div>
            </div>
          </div>

          {/* KLYX_GROUP_FINANCE_AUDIT_METRICS_13_03 */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              label="Missions groupées"
              value={audit.summary.bookingGroupCount}
            />
            <Metric
              label="Paiements Stripe groupe"
              value={audit.summary.distinctGroupPaymentIntents}
            />
            <Metric
              label="Remboursements groupe"
              value={audit.summary.distinctGroupRefunds}
            />
            <Metric
              label="Anomalies suspectes"
              value={
                audit.summary.suspiciousPaymentEvents +
                audit.summary.suspiciousRefundEvents
              }
            />
          </div>

          {audit.summary.duplicatedStripeEvents > 0 ? (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {audit.summary.duplicatedStripeEvents}
              {" événement(s) Stripe apparaissent sur plusieurs lignes du ledger. "}
              KLYX distingue maintenant les répartitions normales entre créneaux
              des répétitions réellement suspectes.
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
