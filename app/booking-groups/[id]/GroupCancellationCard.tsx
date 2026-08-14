"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_GROUP_CANCELLATION_RESOLUTION_UI_12_90

type Props = {
  groupId: string;
  groupStatus: string;
  paymentStatus: string;

  role:
    | "client"
    | "provider";
};

type CancellationState = {
  cancellationStatus?: string;
  resolution?: string;

  requestedRole?:
    | "client"
    | "provider"
    | null;

  reason?:
    | string
    | null;

  refundStatus?: string;

  refundedAmountCents?:
    | number
    | null;

  isRequester?: boolean;

  canRequest?: boolean;
  canWithdraw?: boolean;
  canApprove?: boolean;
  canReject?: boolean;

  message?: string;
  error?: string;
};

async function accessToken() {
  const {
    data: {
      session,
    },
  } =
    await supabase.auth.getSession();

  if (
    !session?.access_token
  ) {
    throw new Error(
      "Session manquante."
    );
  }

  return session.access_token;
}

async function parseResponse(
  response: Response
) {
  const body =
    (await response.json()) as
      CancellationState;

  if (!response.ok) {
    throw new Error(
      body.error ||
        "Action impossible."
    );
  }

  return body;
}

export default function GroupCancellationCard({
  groupId,
  paymentStatus,
}: Props) {
  const [
    state,
    setState,
  ] =
    useState<CancellationState | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    opened,
    setOpened,
  ] =
    useState(false);

  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const token =
            await accessToken();

          const response =
            await fetch(
              "/api/booking-groups/" +
                groupId +
                "/cancellation",
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

          setState(
            await parseResponse(
              response
            )
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Chargement impossible."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        groupId,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  async function sendDecision(
    action:
      | "withdraw"
      | "approve"
      | "reject"
  ) {
    setBusy(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token =
        await accessToken();

      const response =
        await fetch(
          "/api/booking-groups/" +
            groupId +
            "/cancellation",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                token,
            },

            body:
              JSON.stringify({
                action,
              }),
          }
        );

      const body =
        await parseResponse(
          response
        );

      setState(
        body
      );

      setMessage(
        body.message ??
          "Action effectuee."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Action impossible."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  async function createRequest(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setBusy(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token =
        await accessToken();

      const response =
        await fetch(
          "/api/booking-groups/" +
            groupId +
            "/cancellation",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                token,
            },

            body:
              JSON.stringify({
                action:
                  "request",

                reason,
              }),
          }
        );

      const body =
        await parseResponse(
          response
        );

      setState(
        body
      );

      setOpened(
        false
      );

      setMessage(
        body.message ??
          "Demande envoyee."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Envoi impossible."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border p-4 text-sm text-muted-foreground">
        <LoaderCircle
          size={17}
          className="animate-spin"
        />

        Verification de l annulation...
      </div>
    );
  }

  if (!state) {
    return null;
  }

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex gap-3">
        <ShieldCheck
          size={21}
          className="mt-0.5 shrink-0 text-violet-600"
        />

        <div>
          <h2 className="font-black">
            Annulation groupee protegee
          </h2>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Le demandeur ne peut jamais accepter sa propre demande.
            Une annulation payee produit un seul remboursement Stripe
            pour tout le groupe.
          </p>
        </div>
      </div>

      {state.cancellationStatus ===
        "requested" && (
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle
              size={19}
              className="mt-0.5 shrink-0 text-amber-600"
            />

            <div className="flex-1">
              <p className="font-black">
                Demande d annulation ouverte
              </p>

              {state.reason && (
                <p className="mt-2 text-sm leading-6">
                  <strong>
                    Motif :
                  </strong>{" "}
                  {state.reason}
                </p>
              )}

              {paymentStatus ===
                "paid" && (
                <p className="mt-3 text-sm font-bold">
                  Le groupe est deja paye. Ton accord explicite
                  declenchera un remboursement unique de la mission.
                </p>
              )}

              {state.isRequester && (
                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    void sendDecision(
                      "withdraw"
                    )
                  }
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black disabled:opacity-50"
                >
                  <RotateCcw
                    size={16}
                  />

                  Retirer ma demande
                </button>
              )}

              {state.canApprove && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void sendDecision(
                        "reject"
                      )
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black disabled:opacity-50"
                  >
                    <XCircle
                      size={17}
                    />

                    Refuser
                  </button>

                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void sendDecision(
                        "approve"
                      )
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busy ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2
                        size={17}
                      />
                    )}

                    {paymentStatus ===
                    "paid"
                      ? "Accepter et rembourser"
                      : "Accepter l annulation"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state.cancellationStatus !==
        "requested" &&
        state.canRequest && (
          <>
            {!opened ? (
              <button
                type="button"
                onClick={() =>
                  setOpened(
                    true
                  )
                }
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-black text-red-700 dark:text-red-300"
              >
                <XCircle
                  size={17}
                />

                Demander l annulation
              </button>
            ) : (
              <form
                onSubmit={
                  createRequest
                }
                className="mt-5 space-y-4"
              >
                <textarea
                  rows={4}
                  maxLength={500}
                  value={
                    reason
                  }
                  onChange={(
                    event
                  ) =>
                    setReason(
                      event.target.value
                    )
                  }
                  placeholder="Explique la raison..."
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-violet-500"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      setOpened(
                        false
                      )
                    }
                    className="h-11 flex-1 rounded-xl border border-border font-black"
                  >
                    Retour
                  </button>

                  <button
                    type="submit"
                    disabled={
                      busy ||
                      reason.trim().length <
                        10
                    }
                    className="h-11 flex-1 rounded-xl bg-red-600 font-black text-white disabled:opacity-50"
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            )}
          </>
        )}

      {state.resolution ===
        "rejected" && (
        <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          La demande a ete refusee. La mission reste active.
        </div>
      )}

      {state.refundStatus ===
        "processing" && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm font-bold text-violet-700 dark:text-violet-300">
          <LoaderCircle
            size={17}
            className="animate-spin"
          />

          Remboursement Stripe groupe en cours.
        </div>
      )}

      {state.refundStatus ===
        "refunded" && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2
            size={18}
          />

          Mission annulee et remboursement groupe confirme.
        </div>
      )}

      {state.refundStatus ===
        "failed" && (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-300">
          Stripe n a pas finalise le remboursement.
          KLYX conserve le groupe pour verification.
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}
    </section>
  );
}