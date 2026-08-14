"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

// KLYX_GROUP_FINANCE_AUDIT_UI_13_03

type FinanceAudit = {
  auditVersion:
    string;

  readOnly:
    boolean;

  healthy:
    boolean;

  summary: {
    bookingCount:
      number;

    bookingGroupCount:
      number;

    ledgerRowCount:
      number;

    groupedLedgerRowCount:
      number;

    distinctGroupPaymentIntents:
      number;

    distinctGroupRefunds:
      number;

    duplicatedStripeEvents:
      number;

    suspiciousPaymentEvents:
      number;

    suspiciousRefundEvents:
      number;
  };

  automaticExecutionAllowed:
    false;
};

export default function ProviderFinanceAudit() {
  const [
    audit,
    setAudit,
  ] =
    useState<
      FinanceAudit |
      null
    >(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  const load =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setErrorMessage(
          ""
        );

        try {
          const supabase =
            createClient();

          const {
            data: {
              session,
            },
            error:
              sessionError,
          } =
            await supabase.auth.getSession();

          if (
            sessionError
          ) {
            throw new Error(
              sessionError.message
            );
          }

          if (
            !session?.access_token
          ) {
            throw new Error(
              "Session KLYX manquante."
            );
          }

          const response =
            await fetch(
              "/api/provider/finance-audit",
              {
                cache:
                  "no-store",

                headers: {
                  Authorization:
                    "Bearer " +
                    session.access_token,
                },
              }
            );

          const body =
            (await response.json()) as
              FinanceAudit & {
                error?:
                  string;
              };

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
              "Audit financier indisponible."
            );
          }

          setAudit(
            body
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Audit financier indisponible."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  return (
    <section className="klyx-card mt-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ShieldCheck
              size={21}
            />
          </div>

          <div>
            <p className="klyx-eyebrow">
              KLYX Finance
            </p>

            <h2 className="mt-1 text-xl font-black">
              Audit paiements groupés
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              KLYX vérifie que plusieurs créneaux d’une même
              mission ne créent pas artificiellement plusieurs
              événements financiers.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={
            loading
          }
          onClick={
            () =>
              void load()
          }
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-black transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Auditer
        </button>
      </div>

      {loading &&
      !audit ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle
            className="animate-spin"
            size={17}
          />

          Analyse du ledger...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {
            errorMessage
          }
        </div>
      ) : null}

      {audit ? (
        <>
          <div
            className={
              "mt-5 rounded-2xl border p-4 " +
              (
                audit.healthy
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-amber-500/25 bg-amber-500/10"
              )
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
                  Audit 13.03 en lecture seule. Aucun paiement,
                  remboursement ou montant n’est corrigé automatiquement.
                </p>
              </div>
            </div>
          </div>

          {/* KLYX_GROUP_FINANCE_AUDIT_METRICS_13_03 */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              label="Missions groupées"
              value={
                audit.summary.bookingGroupCount
              }
            />

            <Metric
              label="Paiements Stripe groupe"
              value={
                audit.summary.distinctGroupPaymentIntents
              }
            />

            <Metric
              label="Remboursements groupe"
              value={
                audit.summary.distinctGroupRefunds
              }
            />

            <Metric
              label="Anomalies suspectes"
              value={
                audit.summary.suspiciousPaymentEvents +
                audit.summary.suspiciousRefundEvents
              }
            />
          </div>

          {audit.summary.duplicatedStripeEvents >
          0 ? (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {
                audit.summary.duplicatedStripeEvents
              }
              {" événement(s) Stripe apparaissent sur plusieurs lignes du ledger. "}
              KLYX distingue maintenant les répartitions normales
              entre créneaux des répétitions réellement suspectes.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label:
    string;

  value:
    number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4 text-center">
      <p className="text-2xl font-black">
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}