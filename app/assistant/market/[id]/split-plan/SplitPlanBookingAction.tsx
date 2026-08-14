"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_BOOKING_UI_13_19
// KLYX_SPLIT_BOOKING_TYPESCRIPT_FIX_13_19J

type Props = {
  requestId:
    string;
};

type ConfirmationResponse = {
  confirmed?:
    boolean;

  valid?:
    boolean;

  confirmationId?:
    string;

  reconfirmationRequired?:
    boolean;
};

type BookingResult = {
  bookingId:
    string;

  slotId?:
    string;

  position?:
    number;

  providerId?:
    string;
};

type BookingResponse = {
  exists?:
    boolean;

  created?:
    boolean;

  alreadyCreated?:
    boolean;

  batchId?:
    string;

  confirmationId?:
    string;

  bookingCount?:
    number;

  paymentCreated?:
    boolean;

  bookings?:
    BookingResult[];

  batch?: {
    id:
      string;

    status:
      string;

    created_booking_count:
      number;

    failure_reason?:
      string | null;
  };

  code?:
    string;

  error?:
    string;

  supportReviewRequired?:
    boolean;
};

async function token(): Promise<string> {
  const {
    data,
  } =
    await supabase.auth.getSession();

  const accessToken =
    data.session?.access_token;

  if (
    !accessToken
  ) {
    throw new Error(
      "Session KLYX manquante."
    );
  }

  return accessToken;
}

export default function SplitPlanBookingAction({
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
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );

  const [
    confirmationId,
    setConfirmationId,
  ] =
    useState(
      ""
    );

  const [
    proofValid,
    setProofValid,
  ] =
    useState(
      false
    );

  const [
    result,
    setResult,
  ] =
    useState<
      BookingResponse |
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

          const [
            proofResponse,
            batchResponse,
          ] =
            await Promise.all([
              fetch(
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
                      accessToken,
                  },
                }
              ),

              fetch(
                "/api/market/requests/" +
                encodeURIComponent(
                  requestId
                ) +
                "/split-fallback/book",
                {
                  cache:
                    "no-store",

                  headers: {
                    Authorization:
                      "Bearer " +
                      accessToken,
                  },
                }
              ),
            ]);

          const proof =
            (
              await proofResponse.json()
            ) as ConfirmationResponse;

          const batch =
            (
              await batchResponse.json()
            ) as BookingResponse;

          if (
            proofResponse.ok &&
            proof.confirmed ===
              true &&
            proof.valid ===
              true &&
            proof.confirmationId
          ) {
            setProofValid(
              true
            );

            setConfirmationId(
              proof.confirmationId
            );
          }
          else {
            setProofValid(
              false
            );

            setConfirmationId(
              ""
            );
          }

          if (
            batchResponse.ok &&
            batch.exists
          ) {
            setResult(
              batch
            );
          }
          else {
            setResult(
              null
            );
          }
        }
        catch (
          error
        ) {
          setProofValid(
            false
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de verifier la reservation."
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

  async function createBookings() {
    if (
      !confirmationId
    ) {
      return;
    }

    setSubmitting(
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
          "/split-fallback/book",
          {
            method:
              "POST",

            cache:
              "no-store",

            headers: {
              Authorization:
                "Bearer " +
                accessToken,

              "Content-Type":
                "application/json",
            },

            /*
              Action explicite distincte
              de la confirmation 13.18.
            */
            body:
              JSON.stringify({
                confirmationId,

                bookingConfirmed:
                  true,
              }),
          }
        );

      const body =
        (
          await response.json()
        ) as BookingResponse;

      if (
        !response.ok
      ) {
        setResult(
          body
        );

        throw new Error(
          body.error ||
          "Impossible de créer les réservations."
        );
      }

      setResult(
        body
      );

      await refresh();
    }
    catch (
      error
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de créer les réservations."
      );
    }
    finally {
      setSubmitting(
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
          KLYX vérifie la preuve avant d'autoriser la réservation.
        </p>
      </section>
    );
  }

  const existingStatus =
    result?.batch?.status;

  if (
    result?.created ===
      true ||
    existingStatus ===
      "created"
  ) {
    const bookings =
      result?.bookings ??
      [];

    return (
      <section className="mt-7 rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
            <CalendarCheck2
              size={24}
            />
          </div>

          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              Réservations KLYX
            </p>

            <h2 className="mt-2 text-xl font-black">
              Mission multi-prestataires créée
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Les créneaux confirmés sont maintenant de vraies réservations KLYX.
              Aucun paiement n'a encore été effectué.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/bookings"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white"
              >
                Voir mes réservations
              </Link>

              {bookings[0]?.bookingId && (
                <Link
                  href={
                    "/bookings/" +
                    encodeURIComponent(
                      bookings[0].bookingId
                    )
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-black"
                >
                  Ouvrir la première mission
                </Link>
              )}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-background/70 p-4">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-emerald-600"
                size={18}
              />

              <p className="text-xs leading-5 text-muted-foreground">
                La réservation et le paiement restent deux actions distinctes. Aucun paiement Stripe n'a été lancé par 13.19.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (
    existingStatus ===
      "creating" ||
    existingStatus ===
      "failed" ||
    result?.supportReviewRequired
  ) {
    return (
      <section className="mt-7 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-amber-600"
            size={24}
          />

          <div className="flex-1">
            <h2 className="text-xl font-black">
              Vérification de réservation nécessaire
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Une tentative existe déjà. KLYX bloque toute nouvelle création automatique afin d'éviter des réservations en double.
            </p>

            <button
              type="button"
              onClick={() =>
                void refresh()
              }
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black"
            >
              <RefreshCw
                size={16}
              />

              Revérifier
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (
    !proofValid
  ) {
    return null;
  }

  return (
    <section className="mt-7 rounded-[2rem] border border-violet-500/25 bg-violet-500/10 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <CheckCircle2
          className="mt-0.5 shrink-0 text-violet-600"
          size={25}
        />

        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
            Étape réservation
          </p>

          <h2 className="mt-2 text-xl font-black">
            Le plan est confirmé. Veux-tu créer les réservations ?
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            KLYX revérifiera la preuve 13.18 avant de transformer chaque créneau confirmé en réservation.
            Ce clic constitue ton autorisation explicite de réserver.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            disabled={
              submitting
            }
            onClick={() =>
              void createBookings()
            }
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <CalendarCheck2
                size={18}
              />
            )}

            {submitting
              ? "Création sécurisée..."
              : "Créer ces réservations"}
          </button>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Cette action crée uniquement les réservations. Le paiement restera séparé et nécessitera une nouvelle action explicite.
          </p>
        </div>
      </div>
    </section>
  );
}