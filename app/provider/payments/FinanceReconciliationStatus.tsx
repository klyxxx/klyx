"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_FINANCE_RECONCILIATION_UI_13_13

type DifferenceKey =
  | "grossPaidCents"
  | "platformFeeCents"
  | "providerAmountCents"
  | "refundedCents"
  | "refundsProcessingCents";

type DifferenceMap = Record<
  DifferenceKey,
  number
>;

type Reconciliation = {
  checked:
    boolean;

  reconciled:
    boolean;

  status:
    "ok" |
    "review_required" |
    string;

  source:
    string;

  differenceCents:
    DifferenceMap;

  commercialEventsChecked:
    number;

  commercialEventsReturned:
    number;

  historyTruncatedForDisplay:
    boolean;

  readOnly:
    boolean;

  ledgerModified:
    boolean;

  stripeModified:
    boolean;

  automaticCorrection:
    boolean;
};

type FinanceResponse = {
  reconciliation?:
    Reconciliation;

  error?:
    string;
};

const DIFFERENCE_LABELS:
  Record<
    DifferenceKey,
    string
  > = {
    grossPaidCents:
      "Montant brut",

    platformFeeCents:
      "Commission KLYX",

    providerAmountCents:
      "Montant prestataire",

    refundedCents:
      "Remboursements",

    refundsProcessingCents:
      "Remboursements en cours",
  };

function formatDifference(
  cents:
    number
): string {
  const sign =
    cents > 0
      ? "+"
      : "";

  return (
    sign +
    (
      cents /
      100
    ).toFixed(
      2
    ) +
    " €"
  );
}

export default function FinanceReconciliationStatus() {
  const [
    data,
    setData,
  ] =
    useState<
      Reconciliation |
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
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
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
      async (
        manual =
          false
      ) => {
        if (manual) {
          setRefreshing(
            true
          );
        }
        else {
          setLoading(
            true
          );
        }

        setErrorMessage(
          ""
        );

        try {
          const {
            data:
              sessionData,
          } =
            await supabase.auth.getSession();

          const accessToken =
            sessionData.session?.access_token;

          if (
            !accessToken
          ) {
            throw new Error(
              "Session KLYX manquante."
            );
          }

          const response =
            await fetch(
              "/api/provider/finance",
              {
                cache:
                  "no-store",

                headers: {
                  Authorization:
                    "Bearer " +
                    accessToken,
                },
              }
            );

          const body =
            (
              await response.json()
            ) as FinanceResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
              "Impossible de verifier les finances."
            );
          }

          if (
            !body.reconciliation
          ) {
            throw new Error(
              "Etat de reconciliation indisponible."
            );
          }

          setData(
            body.reconciliation
          );
        }
        catch (
          error
        ) {
          setData(
            null
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Verification financiere impossible."
          );
        }
        finally {
          setLoading(
            false
          );

          setRefreshing(
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

  if (
    loading
  ) {
    return (
      <section className="klyx-card mt-6 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <LoaderCircle
            className="animate-spin text-violet-600"
            size={22}
          />

          <div>
            <p className="font-black">
              Vérification financière
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              KLYX compare le résumé financier avec les transactions commerciales.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (
    errorMessage ||
    !data
  ) {
    return (
      <section className="mt-6 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-amber-600"
            size={24}
          />

          <div className="flex-1">
            <p className="font-black text-amber-800 dark:text-amber-200">
              Réconciliation indisponible
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
              {errorMessage ||
                "KLYX ne peut pas verifier les finances actuellement."}
            </p>

            <button
              type="button"
              onClick={() =>
                void load(
                  true
                )
              }
              disabled={
                refreshing
              }
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-amber-500/25 bg-background px-4 text-sm font-black disabled:opacity-50"
            >
              {refreshing ? (
                <LoaderCircle
                  className="animate-spin"
                  size={16}
                />
              ) : (
                <RefreshCw
                  size={16}
                />
              )}

              Réessayer
            </button>
          </div>
        </div>
      </section>
    );
  }

  const differences =
    (
      Object.entries(
        data.differenceCents
      ) as Array<
        [
          DifferenceKey,
          number,
        ]
      >
    ).filter(
      (
        [
          ,
          value,
        ]
      ) =>
        value !==
        0
    );

  if (
    data.reconciled
  ) {
    return (
      <section className="mt-6 rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
              <CheckCircle2
                size={24}
              />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                Contrôle financier KLYX
              </p>

              <h2 className="mt-2 text-xl font-black">
                Finances cohérentes
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Le résumé financier correspond exactement aux transactions commerciales canoniques.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void load(
                true
              )
            }
            disabled={
              refreshing
            }
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-emerald-500/25 bg-background px-4 text-sm font-black disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle
                className="animate-spin"
                size={16}
              />
            ) : (
              <RefreshCw
                size={16}
              />
            )}

            Vérifier
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              Événements vérifiés
            </p>

            <p className="mt-1 text-2xl font-black">
              {data.commercialEventsChecked}
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              Différence
            </p>

            <p className="mt-1 text-2xl font-black text-emerald-600">
              0,00 €
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              Correction automatique
            </p>

            <p className="mt-1 text-sm font-black">
              Désactivée
            </p>
          </article>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
          <ShieldCheck
            className="mt-0.5 shrink-0 text-emerald-600"
            size={18}
          />

          <p className="text-xs leading-5 text-muted-foreground">
            Contrôle en lecture seule : KLYX ne modifie ni Stripe, ni le ledger financier, ni les montants.
            {data.historyTruncatedForDisplay
              ? " L'historique complet est vérifié même si seulement les 100 dernières transactions sont affichées."
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
            <AlertTriangle
              size={24}
            />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
              Contrôle financier KLYX
            </p>

            <h2 className="mt-2 text-xl font-black">
              Vérification nécessaire
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Une différence existe entre le résumé canonique et les transactions commerciales. Aucun montant n'a été corrigé automatiquement.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void load(
              true
            )
          }
          disabled={
            refreshing
          }
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-rose-500/25 bg-background px-4 text-sm font-black disabled:opacity-50"
        >
          {refreshing ? (
            <LoaderCircle
              className="animate-spin"
              size={16}
            />
          ) : (
            <RefreshCw
              size={16}
            />
          )}

          Revérifier
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {differences.length ===
        0 ? (
          <article className="rounded-2xl border border-rose-500/15 bg-background/70 p-4">
            <p className="text-sm font-bold">
              Une incohérence structurelle a été signalée sans différence monétaire explicite.
            </p>
          </article>
        ) : (
          differences.map(
            (
              [
                key,
                value,
              ]
            ) => (
              <article
                key={key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-rose-500/15 bg-background/70 p-4"
              >
                <p className="text-sm font-bold">
                  {DIFFERENCE_LABELS[
                    key
                  ]}
                </p>

                <p className="font-black text-rose-600 dark:text-rose-300">
                  {formatDifference(
                    value
                  )}
                </p>
              </article>
            )
          )
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-rose-600"
          size={18}
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Cette alerte est uniquement diagnostique. Consulte l'audit financier détaillé avant toute action manuelle. Stripe et le ledger restent inchangés.
        </p>
      </div>
    </section>
  );
}