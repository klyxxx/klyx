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
  ShieldAlert,
  Wrench,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_BOOKING_RECOVERY_UI_13_20

type Props = {
  requestId:
    string;
};

type RecoveryResult = {
  found?:
    boolean;

  state?:
    string | null;

  batch?: {
    id:
      string;

    status:
      string;
  };

  expectedBookingCount?:
    number;

  verifiedBookingCount?:
    number;

  itemCount?:
    number;

  canFinalize?:
    boolean;

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

export default function SplitBookingRecovery({
  requestId,
}: Props) {
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
    result,
    setResult,
  ] =
    useState<
      RecoveryResult |
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

  const refresh =
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
              "/api/market/requests/" +
                encodeURIComponent(
                  requestId
                ) +
                "/split-fallback/book/recovery",
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
            ) as RecoveryResult;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                "Vérification impossible."
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
              : "Vérification impossible."
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
      void refresh();
    },
    [
      refresh,
    ]
  );

  async function finalize() {
    const batchId =
      result?.batch?.id;

    if (
      !batchId ||
      busy
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
      const accessToken =
        await token();

      const response =
        await fetch(
          "/api/market/requests/" +
            encodeURIComponent(
              requestId
            ) +
            "/split-fallback/book/recovery",
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
                action:
                  "finalize",

                batchId,

                recoveryConfirmed:
                  true,
              }),
          }
        );

      const body =
        (
          await response.json()
        ) as RecoveryResult;

      if (
        !response.ok
      ) {
        throw new Error(
          body.error ||
            "Récupération impossible."
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
          : "Récupération impossible."
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
      <section className="mt-5 flex items-center gap-3 rounded-2xl border border-border p-4">
        <LoaderCircle
          className="animate-spin"
          size={18}
        />

        <p className="text-sm text-muted-foreground">
          Vérification de l'intégrité des réservations...
        </p>
      </section>
    );
  }

  if (
    !result?.found &&
    !errorMessage
  ) {
    return null;
  }

  if (
    result?.state ===
    "created"
  ) {
    return (
      <section className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
        <div className="flex gap-3">
          <CheckCircle2
            className="shrink-0 text-emerald-600"
            size={20}
          />

          <div>
            <p className="font-black">
              Mission fractionnée sécurisée
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Toutes les réservations attendues sont présentes et la preuve du plan est consommée.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const danger =
    result?.state ===
      "partial_survivors" ||
    result?.state ===
      "integrity_error";

  return (
    <section
      className={
        danger
          ? "mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5"
          : "mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5"
      }
    >
      <div className="flex items-start gap-3">
        {danger ? (
          <ShieldAlert
            className="shrink-0 text-rose-600"
            size={21}
          />
        ) : (
          <AlertTriangle
            className="shrink-0 text-amber-600"
            size={21}
          />
        )}

        <div className="flex-1">
          <p className="font-black">
            Vérification de récupération
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            État :{" "}
            <strong>
              {result?.state ??
                "inconnu"}
            </strong>
          </p>

          {result?.expectedBookingCount != null && (
            <p className="mt-1 text-sm text-muted-foreground">
              Réservations vérifiées :{" "}
              {result.verifiedBookingCount ??
                0}
              /
              {result.expectedBookingCount}
            </p>
          )}

          {result?.state ===
            "partial_survivors" && (
            <p className="mt-3 text-sm font-semibold">
              Certaines réservations existent encore. KLYX ne recrée rien automatiquement afin d'éviter un doublon.
            </p>
          )}

          {result?.state ===
            "integrity_error" && (
            <p className="mt-3 text-sm font-semibold">
              KLYX a détecté une incohérence. Aucune nouvelle réservation ne sera créée automatiquement.
            </p>
          )}

          {result?.state ===
            "clean_failed" && (
            <p className="mt-3 text-sm">
              Aucun booking survivant n'a été détecté. Le retry automatique reste interdit.
            </p>
          )}

          {result?.state ===
            "creating_stale" && (
            <p className="mt-3 text-sm">
              La création semble interrompue. KLYX vérifie l'existant avant toute autre action.
            </p>
          )}

          {result?.state ===
            "complete_but_unfinalized" && (
            <>
              <p className="mt-3 text-sm">
                Toutes les réservations sont présentes, mais le batch n'a pas été finalisé.
              </p>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void finalize()
                }
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={17}
                  />
                ) : (
                  <Wrench
                    size={17}
                  />
                )}

                Finaliser la récupération
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            className="ml-3 mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-black"
          >
            <RefreshCw
              size={16}
            />

            Revérifier
          </button>

          {errorMessage && (
            <p className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
              {errorMessage}
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Cette récupération ne déclenche aucun paiement et ne recrée jamais automatiquement les réservations manquantes.
          </p>
        </div>
      </div>
    </section>
  );
}