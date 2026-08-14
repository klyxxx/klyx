"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_CHECKOUT_UI_13_27

type Unit = {
  id:
    string;

  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  bookingCount:
    number;

  status:
    string;

  checkoutUrl:
    string | null;

  paid:
    boolean;
};

type Result = {
  prepared?:
    boolean;

  status?:
    string;

  runId?:
    string;

  totalAmountCents?:
    number;

  currency?:
    string;

  paymentUnitCount?:
    number;

  paidUnitCount?:
    number;

  units?:
    Unit[];

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
) {
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

export default function SplitMissionCheckout({
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
    preparing,
    setPreparing,
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
      async () => {
        setLoading(
          true
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
                "/checkout",
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
                "Paiements indisponibles."
            );
          }

          setResult(
            body
          );

          setErrorMessage(
            ""
          );
        }
        catch (
          error
        ) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Paiements indisponibles."
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

  async function prepare() {
    if (preparing) {
      return;
    }

    setPreparing(
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
            "/checkout",
          {
            method:
              "POST",

            headers: {
              Authorization:
                "Bearer " +
                accessToken,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                checkoutPreparationConfirmed:
                  true,
              }),
          }
        );

      const body =
        (
          await response.json()
        ) as Result;

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Préparation impossible."
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
          : "Préparation impossible."
      );
    }
    finally {
      setPreparing(
        false
      );
    }
  }

  if (loading) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle
          size={20}
          className="animate-spin text-violet-500"
        />

        <p className="text-sm font-bold text-muted-foreground">
          Vérification des paiements...
        </p>
      </section>
    );
  }

  const units =
    result?.units ??
    [];

  const paidCount =
    units.filter(
      (
        unit
      ) =>
        unit.paid
    ).length;

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            KLYX 13.27
          </p>

          <h2 className="mt-2 text-xl font-black">
            Paiement sécurisé
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Chaque prestataire possède son propre Checkout Stripe. Aucun paiement n'est lancé automatiquement.
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

      {!result?.prepared ? (
        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
          <div className="flex gap-3">
            <LockKeyhole
              size={21}
              className="shrink-0 text-violet-600"
            />

            <div>
              <p className="font-black">
                Dernière étape avant Stripe
              </p>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Ce bouton prépare les pages Stripe correspondant exactement à la confirmation enregistrée. Il ne débite rien.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={
              preparing
            }
            onClick={() =>
              void prepare()
            }
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50"
          >
            {preparing ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <CreditCard
                size={18}
              />
            )}

            Préparer mes paiements
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-black text-muted-foreground">
                Paiements
              </p>

              <p className="mt-2 text-2xl font-black">
                {units.length}
              </p>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-black text-muted-foreground">
                Confirmés
              </p>

              <p className="mt-2 text-2xl font-black text-emerald-600">
                {paidCount}
              </p>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-black text-muted-foreground">
                Total
              </p>

              <p className="mt-2 text-xl font-black">
                {money(
                  result.totalAmountCents ??
                    0,
                  result.currency ??
                    "EUR"
                )}
              </p>
            </div>
          </div>

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

                      <p className="mt-2 text-xl font-black">
                        {money(
                          unit.amountCents,
                          unit.currency
                        )}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {unit.bookingCount} créneau(x)
                      </p>
                    </div>

                    {unit.paid ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-600">
                        <CheckCircle2
                          size={15}
                        />

                        Payé
                      </span>
                    ) : unit.checkoutUrl ? (
                      <a
                        href={
                          unit.checkoutUrl
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"
                      >
                        Payer ce prestataire

                        <ExternalLink
                          size={15}
                        />
                      </a>
                    ) : (
                      <span className="text-xs font-black text-muted-foreground">
                        Actualisation requise
                      </span>
                    )}
                  </div>
                </article>
              )
            )}
          </div>
        </>
      )}

      {units.length > 0 &&
        paidCount ===
          units.length && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            size={22}
            className="shrink-0 text-emerald-600"
          />

          <div>
            <p className="font-black">
              Mission entièrement payée
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Toutes les unités Stripe ont été confirmées par le webhook KLYX.
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
          Une session Stripe ouverte peut être réutilisée. Une session expirée peut être recréée avec une nouvelle tentative idempotente. Une unité déjà payée ne peut jamais être repayée silencieusement.
        </p>
      </div>
    </section>
  );
}