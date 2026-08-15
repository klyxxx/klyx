// KLYX_SPLIT_PAYMENT_PLAN_CURRENCY_PHASE_5G
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  BadgeEuro,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_PAYMENT_CONTRACT_UI_13_24

type Allocation = {
  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  bookingIds:
    string[];

  slotIds:
    string[];

  slotCount:
    number;
};

type PaymentPlanResult = {
  strategy?:
    string;

  architectureVersion?:
    string;

  paymentPlanReady?:
    boolean;

  blockReason?:
    string | null;

  totalAmountCents?:
    number;

  currency?:
    string;

  providerCount?:
    number;

  paymentUnitCount?:
    number;

  allocations?:
    Allocation[];

  providerStripeReadinessChecked?:
    boolean;

  explicitPaymentConfirmationRequired?:
    boolean;

  automaticPayment?:
    boolean;

  paymentCreated?:
    boolean;

  stripeCheckoutCreated?:
    boolean;

  error?:
    string;
};

async function accessToken(): Promise<string> {
  const {
    data,
  } =
    await supabase.auth.getSession();

  const token =
    data.session
      ?.access_token;

  if (!token) {
    throw new Error(
      "Session KLYX manquante."
    );
  }

  return token;
}

function money(
  cents:
    number,

  currency:
    string
): string {
  const code =
    currency
      ?.trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      code
    )
  ) {
    return (
      (
        cents /
        100
      ).toFixed(2) +
      " · devise indisponible"
    );
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency:
        code,
    }
  ).format(
    cents /
    100
  );
}

function blockLabel(
  value:
    string | null | undefined
): string {
  if (
    value ===
    "MISSION_STRUCTURE_CHANGED"
  ) {
    return "La structure de la mission a changé.";
  }

  if (
    value ===
    "PROVIDER_ACCEPTANCE_CHANGED"
  ) {
    return "Un prestataire n'est plus dans l'état accepté.";
  }

  if (
    value ===
    "LIVE_PRICE_CHANGED"
  ) {
    return "Un montant diffère de la preuve de prix confirmée.";
  }

  if (
    value ===
    "PRICE_PROOF_MISMATCH"
  ) {
    return "La preuve de prix n'est plus cohérente.";
  }

  if (
    value ===
    "MULTI_PROVIDER_ALLOCATION_REQUIRED"
  ) {
    return "La mission ne contient plus plusieurs unités prestataires.";
  }

  if (
    value ===
    "PRICE_CONFIRMATION_REQUIRED"
  ) {
    return "Les prix doivent d'abord être confirmés.";
  }

  return "Le paiement n'est pas encore prêt.";
}

export default function SplitMissionPaymentPlan({
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
      PaymentPlanResult |
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
          const token =
            await accessToken();

          const response =
            await fetch(
              "/api/bookings/split-missions/" +
                encodeURIComponent(
                  batchId
                ) +
                "/payment-plan",
              {
                cache:
                  "no-store",

                headers: {
                  Authorization:
                    "Bearer " +
                    token,
                },
              }
            );

          const body =
            (
              await response.json()
            ) as PaymentPlanResult;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                "Contrat de paiement indisponible."
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
              : "Contrat de paiement indisponible."
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

  if (
    loading
  ) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle
          size={20}
          className="animate-spin text-violet-500"
        />

        <p className="text-sm font-bold text-muted-foreground">
          Préparation du contrat de paiement...
        </p>
      </section>
    );
  }

  if (
    errorMessage
  ) {
    return (
      <section className="mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6">
        <CircleAlert
          size={22}
          className="text-rose-600"
        />

        <p className="mt-3 font-black">
          Contrat de paiement indisponible
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw
            size={16}
          />

          Réessayer
        </button>
      </section>
    );
  }

  const allocations =
    result?.allocations ??
    [];

  const currency =
    result?.currency?.trim().toUpperCase() ?? "";

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            KLYX 13.24
          </p>

          <h2 className="mt-2 text-xl font-black">
            Architecture du paiement
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            La mission reste unique pour le client, mais KLYX prépare une unité de paiement distincte pour chaque prestataire.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw
            size={16}
          />

          Actualiser
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <UsersRound
            size={18}
            className="text-violet-500"
          />

          <p className="mt-3 text-xs font-black text-muted-foreground">
            Prestataires
          </p>

          <p className="mt-1 text-2xl font-black">
            {result?.providerCount ??
              0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <CreditCard
            size={18}
            className="text-violet-500"
          />

          <p className="mt-3 text-xs font-black text-muted-foreground">
            Unités de paiement
          </p>

          <p className="mt-1 text-2xl font-black">
            {result?.paymentUnitCount ??
              0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <BadgeEuro
            size={18}
            className="text-violet-500"
          />

          <p className="mt-3 text-xs font-black text-muted-foreground">
            Total mission
          </p>

          <p className="mt-1 text-xl font-black">
            {money(
              result?.totalAmountCents ??
                0,
              currency
            )}
          </p>
        </div>
      </div>

      {allocations.length >
        0 && (
        <div className="mt-6 grid gap-3">
          {allocations.map(
            (
              allocation,
              index
            ) => (
              <article
                key={
                  allocation.providerId
                }
                className="rounded-2xl border border-border bg-background/60 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Paiement prestataire{" "}
                      {index + 1}
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {money(
                        allocation.amountCents,
                        allocation.currency
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Créneaux
                    </p>

                    <p className="mt-1 font-black">
                      {allocation.slotCount}
                    </p>
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      )}

      {result?.paymentPlanReady ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            size={22}
            className="shrink-0 text-emerald-600"
          />

          <div>
            <p className="font-black">
              Contrat de paiement cohérent
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Les montants correspondent toujours exactement à la confirmation de prix et tous les prestataires sont encore acceptés.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <CircleAlert
            size={22}
            className="shrink-0 text-amber-600"
          />

          <div>
            <p className="font-black">
              Paiement bloqué
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {blockLabel(
                result?.blockReason
              )}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
        <div className="flex gap-3">
          <LockKeyhole
            size={20}
            className="shrink-0 text-violet-600"
          />

          <div>
            <p className="font-black">
              Aucun paiement n'est créé ici
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              13.24 définit seulement le contrat commercial. La disponibilité Stripe Connect de chaque prestataire sera vérifiée avant d'autoriser une création de paiement.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-violet-500"
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Une mission client · plusieurs unités prestataires · confirmation de paiement explicite obligatoire · aucun Checkout Stripe automatique.
        </p>
      </div>
    </section>
  );
}