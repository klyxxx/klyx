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
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_REFUND_STATUS_UI_13_28

type RefundUnit = {
  id:
    string;

  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  paymentStatus:
    string;

  refundStatus:
    string;

  refundedAmountCents:
    number;

  fullyRefunded:
    boolean;

  refundFailureReason:
    string | null;
};

type Result = {
  paymentRunExists?:
    boolean;

  runStatus?:
    string;

  totalAmountCents?:
    number;

  totalRefundedAmountCents?:
    number;

  currency?:
    string;

  paymentUnitCount?:
    number;

  refundedUnitCount?:
    number;

  refundInProgress?:
    boolean;

  refundFailure?:
    boolean;

  units?:
    RefundUnit[];

  error?:
    string;
};

async function token(): Promise<string> {
  const {
    data,
  } =
    await supabase.auth.getSession();

  const accessToken =
    data.session
      ?.access_token;

  if (!accessToken) {
    throw new Error(
      "Session KLYX manquante."
    );
  }

  return accessToken;
}

function money(
  cents:
    number,

  currency:
    string
): string {
  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency:
        currency ||
        "EUR",
    }
  ).format(
    cents /
    100
  );
}

function refundLabel(
  value:
    string
): string {
  if (
    value ===
    "refunded"
  ) {
    return "Remboursé";
  }

  if (
    value ===
    "partially_refunded"
  ) {
    return "Partiellement remboursé";
  }

  if (
    value ===
    "processing"
  ) {
    return "Remboursement en cours";
  }

  if (
    value ===
    "failed"
  ) {
    return "Remboursement à vérifier";
  }

  return "Aucun remboursement";
}

export default function SplitMissionRefundStatus({
  batchId,
}: {
  batchId:
    string;
}) {
  const [
    result,
    setResult,
  ] =
    useState<
      Result |
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
          const accessToken =
            await token();

          const response =
            await fetch(
              "/api/bookings/split-missions/" +
                encodeURIComponent(
                  batchId
                ) +
                "/refund-status",
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
            ) as Result;

          if (!response.ok) {
            throw new Error(
              body.error ||
                "État des remboursements indisponible."
            );
          }

          setResult(
            body
          );
        }
        catch (
          error
        ) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "État des remboursements indisponible."
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [
        batchId,
      ]
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  if (loading) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle
          size={20}
          className="animate-spin text-violet-500"
        />

        <p className="text-sm font-bold text-muted-foreground">
          Vérification des remboursements...
        </p>
      </section>
    );
  }

  if (
    !result?.paymentRunExists &&
    !errorMessage
  ) {
    return null;
  }

  const units =
    result?.units ??
    [];

  const currency =
    result?.currency ??
    "EUR";

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            KLYX 13.28
          </p>

          <h2 className="mt-2 text-xl font-black">
            Remboursements de la mission
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Chaque paiement prestataire est suivi séparément pour éviter qu'un remboursement n'affecte le mauvais créneau ou le mauvais prestataire.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-black"
        >
          <RefreshCw
            size={16}
          />

          Actualiser
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black text-muted-foreground">
            Total mission
          </p>

          <p className="mt-2 text-xl font-black">
            {money(
              result?.totalAmountCents ??
                0,
              currency
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black text-muted-foreground">
            Remboursé
          </p>

          <p className="mt-2 text-xl font-black">
            {money(
              result?.totalRefundedAmountCents ??
                0,
              currency
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black text-muted-foreground">
            Unités remboursées
          </p>

          <p className="mt-2 text-2xl font-black">
            {result?.refundedUnitCount ??
              0}
            /
            {result?.paymentUnitCount ??
              0}
          </p>
        </div>
      </div>

      {units.length > 0 && (
        <div className="mt-6 grid gap-3">
          {units.map(
            (
              unit,
              index
            ) => (
              <article
                key={
                  unit.id
                }
                className="rounded-2xl border border-border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-muted-foreground">
                      Prestataire{" "}
                      {index + 1}
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {refundLabel(
                        unit.refundStatus
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Remboursé
                    </p>

                    <p className="mt-1 font-black">
                      {money(
                        unit.refundedAmountCents,
                        unit.currency
                      )}
                      {" / "}
                      {money(
                        unit.amountCents,
                        unit.currency
                      )}
                    </p>
                  </div>
                </div>

                {unit.refundFailureReason && (
                  <p className="mt-3 text-sm font-semibold text-rose-600">
                    {unit.refundFailureReason}
                  </p>
                )}
              </article>
            )
          )}
        </div>
      )}

      {result?.refundInProgress && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <RotateCcw
            size={21}
            className="shrink-0 text-amber-600"
          />

          <div>
            <p className="font-black">
              Remboursement Stripe en cours
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              KLYX attend la confirmation finale de Stripe avant de considérer les fonds comme remboursés.
            </p>
          </div>
        </div>
      )}

      {result?.refundFailure && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <AlertTriangle
            size={21}
            className="shrink-0 text-rose-600"
          />

          <div>
            <p className="font-black">
              Un remboursement nécessite une vérification
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              KLYX conserve l'incident dans l'historique financier au lieu de prétendre que le remboursement a réussi.
            </p>
          </div>
        </div>
      )}

      {units.length > 0 &&
        units.every(
          (
            unit
          ) =>
            unit.fullyRefunded
        ) && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            size={22}
            className="shrink-0 text-emerald-600"
          />

          <div>
            <p className="font-black">
              Mission entièrement remboursée
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Toutes les unités Stripe de cette mission ont été réconciliées comme remboursées.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm font-semibold">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex gap-3 border-t border-border pt-5">
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-violet-500"
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Cette page suit les remboursements mais ne permet pas au client de déclencher arbitrairement un remboursement. L'exécution sera liée à une décision d'annulation KLYX explicite.
        </p>
      </div>
    </section>
  );
}