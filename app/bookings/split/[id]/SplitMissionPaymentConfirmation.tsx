"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_PAYMENT_CONFIRMATION_UI_13_26

type PaymentUnit = {
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

  stripeAccountId:
    string;
};

type PaymentPlan = {
  providerCount:
    number;

  paymentUnitCount:
    number;

  totalAmountCents:
    number;

  currency:
    string;

  units:
    PaymentUnit[];
};

type PaymentConfirmationResult = {
  paymentConfirmationReady?:
    boolean;

  blockReason?:
    string | null;

  confirmed?:
    boolean;

  confirmationId?:
    string | null;

  paymentPlan?:
    PaymentPlan | null;

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
  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency,
    }
  ).format(
    cents /
    100
  );
}

function blockLabel(
  value:
    string |
    null |
    undefined
): string {
  if (
    value ===
    "PRICE_CONFIRMATION_REQUIRED"
  ) {
    return "Les prix doivent être confirmés.";
  }

  if (
    value ===
    "MISSION_STRUCTURE_CHANGED"
  ) {
    return "La structure de la mission a changé.";
  }

  if (
    value ===
    "LIVE_PAYMENT_PLAN_CHANGED"
  ) {
    return "Les montants ou l'acceptation ont changé.";
  }

  if (
    value ===
    "PROVIDER_STRIPE_NOT_READY"
  ) {
    return "Au moins un prestataire n'est plus prêt sur Stripe.";
  }

  if (
    value ===
    "PROVIDER_STRIPE_LOOKUP_FAILED"
  ) {
    return "Impossible de revalider un compte Stripe.";
  }

  if (
    value ===
    "PAYMENT_ALLOCATION_MISMATCH"
  ) {
    return "La répartition du paiement n'est plus cohérente.";
  }

  return "La confirmation du paiement n'est pas encore disponible.";
}

export default function SplitMissionPaymentConfirmation({
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
      PaymentConfirmationResult |
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
    busy,
    setBusy,
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

  const [
    amountAcknowledged,
    setAmountAcknowledged,
  ] =
    useState(
      false
    );

  const [
    splitAcknowledged,
    setSplitAcknowledged,
  ] =
    useState(
      false
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
                "/payment-confirmation",
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
            ) as PaymentConfirmationResult;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                "Confirmation indisponible."
            );
          }

          setResult(
            body
          );

          if (
            body.confirmed
          ) {
            setAmountAcknowledged(
              true
            );

            setSplitAcknowledged(
              true
            );
          }
        }
        catch (
          error
        ) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Confirmation indisponible."
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

  async function confirm() {
    if (
      busy ||
      !result?.paymentConfirmationReady ||
      !amountAcknowledged ||
      !splitAcknowledged
    ) {
      return;
    }

    setBusy(
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
            "/payment-confirmation",
          {
            method:
              "POST",

            headers: {
              Authorization:
                "Bearer " +
                token,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                paymentConfirmed:
                  true,

                finalAmountAcknowledged:
                  true,

                separateProviderPaymentsAcknowledged:
                  true,
              }),
          }
        );

      const body =
        (
          await response.json()
        ) as PaymentConfirmationResult;

      if (
        !response.ok
      ) {
        throw new Error(
          body.error ||
            "Confirmation impossible."
        );
      }

      await load();
    }
    catch (
      error
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Confirmation impossible."
      );
    }
    finally {
      setBusy(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle
          className="animate-spin text-violet-500"
          size={20}
        />

        <p className="text-sm font-bold text-muted-foreground">
          Préparation de la confirmation finale...
        </p>
      </section>
    );
  }

  const plan =
    result?.paymentPlan;

  const units =
    plan?.units ??
    [];

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            KLYX 13.26
          </p>

          <h2 className="mt-2 text-xl font-black">
            Confirmation finale du paiement
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Confirme le montant final et sa répartition avant que KLYX soit autorisé à créer une étape de paiement.
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

      {plan && (
        <>
          <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
            <p className="text-sm font-black text-muted-foreground">
              Montant total confirmé
            </p>

            <p className="mt-2 text-3xl font-black">
              {money(
                plan.totalAmountCents,
                plan.currency
              )}
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              {plan.paymentUnitCount} unité(s) de paiement ·{" "}
              {plan.providerCount} prestataire(s)
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {units.map(
              (
                unit,
                index
              ) => (
                <article
                  key={
                    unit.providerId
                  }
                  className="rounded-2xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-muted-foreground">
                        Prestataire{" "}
                        {index + 1}
                      </p>

                      <p className="mt-1 font-black">
                        {unit.slotIds.length} créneau(x)
                      </p>
                    </div>

                    <p className="text-lg font-black">
                      {money(
                        unit.amountCents,
                        unit.currency
                      )}
                    </p>
                  </div>
                </article>
              )
            )}
          </div>
        </>
      )}

      {!result?.paymentConfirmationReady && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <AlertTriangle
            size={21}
            className="shrink-0 text-amber-600"
          />

          <div>
            <p className="font-black">
              Confirmation bloquée
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {blockLabel(
                result?.blockReason
              )}
            </p>
          </div>
        </div>
      )}

      {result?.paymentConfirmationReady &&
        !result.confirmed && (
        <div className="mt-6 grid gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-5">
            <input
              type="checkbox"
              checked={
                amountAcknowledged
              }
              onChange={
                (
                  event
                ) =>
                  setAmountAcknowledged(
                    event.target.checked
                  )
              }
              className="mt-1"
            />

            <span>
              <strong>
                Je confirme le montant total affiché.
              </strong>

              <span className="mt-1 block text-sm text-muted-foreground">
                Aucun montant ne pourra être modifié silencieusement après cette confirmation.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-5">
            <input
              type="checkbox"
              checked={
                splitAcknowledged
              }
              onChange={
                (
                  event
                ) =>
                  setSplitAcknowledged(
                    event.target.checked
                  )
              }
              className="mt-1"
            />

            <span>
              <strong>
                Je confirme la répartition entre les prestataires.
              </strong>

              <span className="mt-1 block text-sm text-muted-foreground">
                La mission reste unique, mais chaque prestataire correspond à une unité de paiement distincte.
              </span>
            </span>
          </label>

          <button
            type="button"
            disabled={
              busy ||
              !amountAcknowledged ||
              !splitAcknowledged
            }
            onClick={() =>
              void confirm()
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white disabled:opacity-50 sm:w-auto"
          >
            {busy ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <LockKeyhole
                size={18}
              />
            )}

            Confirmer le paiement
          </button>
        </div>
      )}

      {result?.confirmed && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            size={22}
            className="shrink-0 text-emerald-600"
          />

          <div>
            <p className="font-black">
              Confirmation explicite enregistrée
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              KLYX possède maintenant la preuve exacte du montant et de la répartition approuvés. Aucun débit n'a encore été effectué.
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
        <CreditCard
          size={18}
          className="mt-0.5 shrink-0 text-violet-500"
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Confirmation ≠ débit. Aucun PaymentIntent, aucun Checkout, aucun Transfer et aucun mouvement d'argent ne sont créés par 13.26.
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-emerald-600"
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Toute modification ultérieure du plan de paiement invalide la preuve et impose une nouvelle confirmation.
        </p>
      </div>
    </section>
  );
}