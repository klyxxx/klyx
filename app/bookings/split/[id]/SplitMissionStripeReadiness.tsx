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
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_STRIPE_READINESS_UI_13_25

type ProviderStripeState =
  | "ready"
  | "missing_account"
  | "restricted"
  | "lookup_failed";

type ProviderStripeResult = {
  providerId:
    string;

  providerName:
    string;

  state:
    ProviderStripeState;

  account:
    string | null;

  chargesEnabled:
    boolean;

  payoutsEnabled:
    boolean;

  detailsSubmitted:
    boolean;

  requirementsDue:
    number;

  ready:
    boolean;
};

type StripeReadinessResult = {
  stripeReadinessComplete?:
    boolean;

  allProvidersStripeReady?:
    boolean;

  paymentInfrastructureReady?:
    boolean;

  blockReason?:
    string | null;

  providerCount?:
    number;

  readyProviderCount?:
    number;

  providers?:
    ProviderStripeResult[];

  explicitPaymentConfirmationRequired?:
    boolean;

  paymentCreated?:
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

function stateLabel(
  state:
    ProviderStripeState
): string {
  if (
    state ===
    "ready"
  ) {
    return "Stripe prêt";
  }

  if (
    state ===
    "missing_account"
  ) {
    return "Compte Stripe manquant";
  }

  if (
    state ===
    "lookup_failed"
  ) {
    return "Vérification impossible";
  }

  return "Compte Stripe incomplet";
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
    return "Les prix doivent être confirmés avant la vérification Stripe.";
  }

  if (
    value ===
    "PAYMENT_PLAN_REVALIDATION_REQUIRED"
  ) {
    return "Le contrat de paiement doit être revalidé.";
  }

  if (
    value ===
    "STRIPE_SERVER_CONFIGURATION_REQUIRED"
  ) {
    return "La configuration Stripe serveur est indisponible.";
  }

  if (
    value ===
    "PROVIDER_STRIPE_NOT_READY"
  ) {
    return "Au moins un prestataire n'est pas encore prêt à recevoir un paiement.";
  }

  if (
    value ===
    "MULTI_PROVIDER_REQUIRED"
  ) {
    return "Au moins deux prestataires sont requis pour cette mission.";
  }

  return "L'infrastructure de paiement n'est pas encore prête.";
}

export default function SplitMissionStripeReadiness({
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
      StripeReadinessResult |
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
                "/stripe-readiness",
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
            ) as StripeReadinessResult;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                "Vérification Stripe impossible."
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
              : "Vérification Stripe impossible."
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
          Vérification Stripe Connect...
        </p>
      </section>
    );
  }

  if (
    errorMessage
  ) {
    return (
      <section className="mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6">
        <ShieldX
          size={22}
          className="text-rose-600"
        />

        <p className="mt-3 font-black">
          Stripe Connect indisponible
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

  const providers =
    result?.providers ??
    [];

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            KLYX 13.25
          </p>

          <h2 className="mt-2 text-xl font-black">
            Disponibilité Stripe Connect
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            KLYX vérifie en direct si chaque prestataire peut réellement recevoir sa part du paiement.
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-black text-muted-foreground">
            Prestataires vérifiés
          </p>

          <p className="mt-2 text-2xl font-black">
            {result?.providerCount ??
              0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-black text-muted-foreground">
            Prêts pour Stripe
          </p>

          <p className="mt-2 text-2xl font-black text-emerald-600">
            {result?.readyProviderCount ??
              0}
          </p>
        </div>
      </div>

      {providers.length >
        0 && (
        <div className="mt-6 grid gap-3">
          {providers.map(
            (
              provider
            ) => (
              <article
                key={
                  provider.providerId
                }
                className="rounded-2xl border border-border bg-background/60 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-muted">
                      <UserRound
                        size={20}
                      />
                    </div>

                    <div>
                      <p className="font-black">
                        {provider.providerName}
                      </p>

                      {provider.account && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stripe{" "}
                          {provider.account}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={
                      provider.ready
                        ? "rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600"
                        : "rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600"
                    }
                  >
                    {stateLabel(
                      provider.state
                    )}
                  </span>
                </div>

                {!provider.ready && (
                  <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>
                      Paiements activés :{" "}
                      <strong>
                        {provider.chargesEnabled
                          ? "oui"
                          : "non"}
                      </strong>
                    </p>

                    <p>
                      Versements activés :{" "}
                      <strong>
                        {provider.payoutsEnabled
                          ? "oui"
                          : "non"}
                      </strong>
                    </p>

                    <p>
                      Informations complètes :{" "}
                      <strong>
                        {provider.detailsSubmitted
                          ? "oui"
                          : "non"}
                      </strong>
                    </p>

                    <p>
                      Exigences restantes :{" "}
                      <strong>
                        {provider.requirementsDue}
                      </strong>
                    </p>
                  </div>
                )}
              </article>
            )
          )}
        </div>
      )}

      {result?.allProvidersStripeReady ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            size={22}
            className="shrink-0 text-emerald-600"
          />

          <div>
            <p className="font-black">
              Infrastructure Stripe prête
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Tous les prestataires disposent actuellement d'un compte Stripe Connect opérationnel.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <AlertTriangle
            size={22}
            className="shrink-0 text-amber-600"
          />

          <div>
            <p className="font-black">
              Paiement toujours bloqué
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {blockLabel(
                result?.blockReason
              )}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
        <CreditCard
          size={20}
          className="shrink-0 text-violet-600"
        />

        <div>
          <p className="font-black">
            Aucun débit à cette étape
          </p>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Même lorsque tous les comptes Stripe sont prêts, KLYX exige encore une confirmation explicite du client avant toute création de paiement.
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-violet-500"
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Vérification Stripe en direct · aucun PaymentIntent · aucun Checkout · aucun Transfer · aucun paiement automatique.
        </p>
      </div>
    </section>
  );
}