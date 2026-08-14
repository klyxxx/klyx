"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BadgeEuro,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_PRICE_CONFIRMATION_UI_13_23

type PriceItem = {
  slotId:
    string;

  position:
    number;

  bookingId:
    string;

  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  budgetMaxCents:
    number | null;

  overBudget:
    boolean;
};

type PriceResult = {
  confirmed?:
    boolean;

  confirmationId?:
    string | null;

  confirmedAt?:
    string | null;

  canConfirm?:
    boolean;

  allProvidersAccepted?:
    boolean;

  completePriceData?:
    boolean;

  technicalMismatch?:
    boolean;

  priceChangedAfterConfirmation?:
    boolean;

  reconfirmationRequired?:
    boolean;

  missingPriceCount?:
    number;

  missingCurrencyCount?:
    number;

  mixedCurrency?:
    boolean;

  currency?:
    string | null;

  totalAmountCents?:
    number;

  overBudgetCount?:
    number;

  items?:
    PriceItem[];

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

export default function SplitMissionPriceConfirmation({
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
      PriceResult |
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
    overBudgetAccepted,
    setOverBudgetAccepted,
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
                "/prices",
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
            ) as PriceResult;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                "Prix indisponibles."
            );
          }

          setResult(
            body
          );

          if (
            body.confirmed
          ) {
            setOverBudgetAccepted(
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
              : "Prix indisponibles."
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

  const items =
    useMemo(
      () =>
        result?.items ??
        [],
      [
        result,
      ]
    );

  async function confirmPrices() {
    if (
      busy ||
      !result?.canConfirm
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
            "/prices",
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
                priceConfirmed:
                  true,

                overBudgetAcknowledged:
                  overBudgetAccepted,
              }),
          }
        );

      const body =
        (
          await response.json()
        ) as PriceResult;

      if (
        !response.ok
      ) {
        throw new Error(
          body.error ||
            "Confirmation des prix impossible."
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
          : "Confirmation des prix impossible."
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
          Vérification des prix de la mission...
        </p>
      </section>
    );
  }

  const currency =
    result?.currency ??
    "";

  const overBudgetCount =
    result?.overBudgetCount ??
    0;

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            Prix sécurisés
          </p>

          <h2 className="mt-2 text-xl font-black">
            Vérification des montants
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            KLYX vérifie le montant enregistré sur chaque réservation avant toute future étape de paiement.
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

      {result?.priceChangedAfterConfirmation && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <AlertTriangle
            className="shrink-0 text-amber-600"
            size={20}
          />

          <div>
            <p className="font-black">
              Un prix a changé
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              L'ancienne confirmation a été invalidée. Les nouveaux montants doivent être confirmés à nouveau.
            </p>
          </div>
        </div>
      )}

      {result?.technicalMismatch && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <AlertTriangle
            className="shrink-0 text-rose-600"
            size={20}
          />

          <p className="text-sm font-semibold">
            L'intégrité de la mission doit être rétablie avant de confirmer les prix.
          </p>
        </div>
      )}

      {!result?.allProvidersAccepted &&
        !result?.technicalMismatch && (
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <p className="font-black">
            Acceptation encore incomplète
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Les prix ne peuvent être verrouillés qu'après l'acceptation de tous les prestataires.
          </p>
        </div>
      )}

      {(result?.missingPriceCount ?? 0) >
        0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <p className="font-black">
            Prix manquant
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Au moins une réservation ne possède pas encore de montant exploitable.
          </p>
        </div>
      )}

      {(result?.missingCurrencyCount ?? 0) >
        0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <p className="font-black">
            Devise manquante
          </p>
        </div>
      )}

      {result?.mixedCurrency && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <p className="font-black">
            Plusieurs devises détectées
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            KLYX bloque la confirmation tant que tous les créneaux ne partagent pas une seule devise.
          </p>
        </div>
      )}

      {items.length >
        0 && (
        <div className="mt-6 grid gap-3">
          {items.map(
            (
              item
            ) => (
              <article
                key={
                  item.slotId
                }
                className="rounded-2xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-muted-foreground">
                      Créneau{" "}
                      {item.position}
                    </p>

                    <p className="mt-1 text-lg font-black">
                      {money(
                        item.amountCents,
                        item.currency
                      )}
                    </p>
                  </div>

                  {item.budgetMaxCents !==
                    null && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Budget du plan
                      </p>

                      <p className="font-black">
                        {money(
                          item.budgetMaxCents,
                          item.currency
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {item.overBudget && (
                  <p className="mt-3 text-sm font-black text-rose-600">
                    Ce montant dépasse le budget prévu pour ce créneau.
                  </p>
                )}
              </article>
            )
          )}
        </div>
      )}

      {currency &&
        result?.totalAmountCents !=
          null && (
        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
          <p className="flex items-center gap-2 text-sm font-black text-muted-foreground">
            <BadgeEuro
              size={17}
            />

            Total actuellement enregistré
          </p>

          <p className="mt-2 text-3xl font-black">
            {money(
              result.totalAmountCents,
              currency
            )}
          </p>
        </div>
      )}

      {overBudgetCount >
        0 &&
        !result?.confirmed && (
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <input
            type="checkbox"
            checked={
              overBudgetAccepted
            }
            onChange={
              (
                event
              ) =>
                setOverBudgetAccepted(
                  event.target.checked
                )
            }
            className="mt-1"
          />

          <span>
            <strong>
              J'accepte explicitement le dépassement de budget.
            </strong>

            <span className="mt-1 block text-sm text-muted-foreground">
              {overBudgetCount} créneau(x) dépasse(nt) le budget indiqué dans le plan confirmé.
            </span>
          </span>
        </label>
      )}

      {result?.confirmed ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            className="shrink-0 text-emerald-600"
            size={22}
          />

          <div>
            <p className="font-black">
              Prix confirmés
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              La preuve correspond exactement aux montants actuellement enregistrés.
            </p>
          </div>
        </div>
      ) : result?.canConfirm ? (
        <button
          type="button"
          disabled={
            busy ||
            (
              overBudgetCount >
                0 &&
              !overBudgetAccepted
            )
          }
          onClick={() =>
            void confirmPrices()
          }
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white disabled:opacity-50 sm:w-auto"
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

          Confirmer ces prix
        </button>
      ) : null}

      {errorMessage && (
        <p className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex gap-3 border-t border-border pt-5">
        <CheckCircle2
          className="mt-0.5 shrink-0 text-violet-500"
          size={18}
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Cette confirmation ne paie rien. Elle constitue uniquement une preuve explicite des prix acceptés par le client avant toute future architecture de paiement multi-prestataires.
        </p>
      </div>
    </section>
  );
}