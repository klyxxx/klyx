"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_PLAN_CONFIRMATION_UI_13_18
// KLYX_SPLIT_PLAN_CONFIRMATION_UI_COMPAT_13_19E

type Props = {
  requestId:
    string;

  plan:
    unknown;
};

type ConfirmationResponse = {
  confirmed?:
    boolean;

  valid?:
    boolean;

  confirmationId?:
    string;

  planHash?:
    string;

  reconfirmationRequired?:
    boolean;

  code?:
    string;

  error?:
    string;
};

async function accessToken(): Promise<string> {
  const {
    data,
  } =
    await supabase.auth.getSession();

  const token =
    data.session?.access_token;

  if (!token) {
    throw new Error(
      "Session KLYX manquante."
    );
  }

  return token;
}

export default function SplitPlanConfirmation({
  requestId,
  plan,
}: Props) {
  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    confirming,
    setConfirming,
  ] =
    useState(
      false
    );

  const [
    confirmation,
    setConfirmation,
  ] =
    useState<
      ConfirmationResponse |
      null
    >(
      null
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  const check =
    useCallback(
      async () => {
        if (!requestId) {
          setLoading(
            false
          );

          return;
        }

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
              "/api/market/requests/" +
                encodeURIComponent(
                  requestId
                ) +
                "/split-fallback/confirm",
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
            ) as ConfirmationResponse;

          if (
            response.status ===
            409
          ) {
            setConfirmation({
              ...body,

              confirmed:
                false,

              valid:
                false,

              reconfirmationRequired:
                true,
            });

            return;
          }

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                "Impossible de vérifier la confirmation."
            );
          }

          setConfirmation(
            body
          );
        }
        catch (
          error
        ) {
          setConfirmation(
            null
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier la confirmation."
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [
        requestId,
      ]
    );

  useEffect(
    () => {
      void check();
    },
    [
      check,
    ]
  );

  async function confirmPlan() {
    if (
      !requestId ||
      confirming
    ) {
      return;
    }

    setConfirming(
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
          "/api/market/requests/" +
            encodeURIComponent(
              requestId
            ) +
            "/split-fallback/confirm",
          {
            method:
              "POST",

            cache:
              "no-store",

            headers: {
              Authorization:
                "Bearer " +
                token,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                plan,
              }),
          }
        );

      const body =
        (
          await response.json()
        ) as ConfirmationResponse;

      if (
        !response.ok
      ) {
        setConfirmation({
          ...body,

          confirmed:
            false,

          valid:
            false,

          reconfirmationRequired:
            response.status ===
            409,
        });

        throw new Error(
          body.error ||
            "Le plan doit être revérifié."
        );
      }

      setConfirmation(
        body
      );
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
      setConfirming(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <section className="klyx-card mt-7 flex items-center gap-3 p-6">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={20}
        />

        <p className="text-sm text-muted-foreground">
          KLYX vérifie la confirmation de ce plan.
        </p>
      </section>
    );
  }

  if (
    confirmation?.confirmed ===
      true &&
    confirmation.valid ===
      true
  ) {
    return (
      <section className="mt-7 rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
            <CheckCircle2
              size={24}
            />
          </div>

          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              Confirmation sécurisée
            </p>

            <h2 className="mt-2 text-xl font-black">
              Ce plan exact est confirmé
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              La preuve est liée aux créneaux et aux prestataires actuellement affichés.
              Toute modification du plan invalidera cette confirmation.
            </p>

            {confirmation.confirmationId && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-background/70 px-4 py-2 text-xs font-black">
                <Fingerprint
                  size={15}
                />

                Preuve{" "}
                {confirmation.confirmationId.slice(
                  0,
                  8
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                void check()
              }
              className="ml-3 mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-black"
            >
              <RefreshCw
                size={15}
              />

              Revérifier
            </button>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-emerald-600"
                size={18}
              />

              <p className="text-xs leading-5 text-muted-foreground">
                Cette confirmation ne crée aucune réservation et ne déclenche aucun paiement.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const changed =
    confirmation?.reconfirmationRequired ===
    true;

  return (
    <section
      className={
        changed
          ? "mt-7 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-6 sm:p-8"
          : "mt-7 rounded-[2rem] border border-violet-500/25 bg-violet-500/10 p-6 sm:p-8"
      }
    >
      <div className="flex items-start gap-4">
        {changed ? (
          <AlertTriangle
            className="mt-0.5 shrink-0 text-amber-600"
            size={24}
          />
        ) : (
          <Fingerprint
            className="mt-0.5 shrink-0 text-violet-600"
            size={24}
          />
        )}

        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Confirmation client
          </p>

          <h2 className="mt-2 text-xl font-black">
            {changed
              ? "Le plan a changé"
              : "Confirmer cette répartition exacte"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {changed
              ? "L'ancienne confirmation n'est plus valable. Vérifie la nouvelle répartition puis confirme-la."
              : "KLYX revérifie les disponibilités au moment du clic avant d'enregistrer la preuve de ce plan."}
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            disabled={
              confirming
            }
            onClick={() =>
              void confirmPlan()
            }
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-50"
          >
            {confirming ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <CheckCircle2
                size={18}
              />
            )}

            {confirming
              ? "Vérification..."
              : "Je confirme exactement ce plan"}
          </button>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            La réservation restera une action séparée après cette confirmation.
          </p>
        </div>
      </div>
    </section>
  );
}