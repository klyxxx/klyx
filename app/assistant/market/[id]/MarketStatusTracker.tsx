"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StatusData = {
  requestId: string;
  stage:
    | "waiting_offers"
    | "compare_offers"
    | "finalize_booking"
    | "booking_created"
    | "payment_pending"
    | "paid"
    | "completed";
  title: string;
  description: string;
  nextHref: string;
  nextLabel: string;
  offerCount: number;
  sentOfferCount: number;
  quoteId: string | null;
  bookingId: string | null;
  bookingStatus: string | null;
  paymentStatus: string | null;
};

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function MarketStatusTracker({
  requestId,
}: {
  requestId: string;
}) {
  const [data, setData] =
    useState<StatusData | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const load = useCallback(
    async (manual = false) => {
      manual
        ? setRefreshing(true)
        : setLoading(true);

      setErrorMessage("");

      try {
        const accessToken =
          await token();

        const response = await fetch(
          `/api/brain/market-status/${requestId}`,
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

        const body = (await response.json()) as
          | StatusData
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in body
              ? body.error ||
                  "Suivi indisponible."
              : "Suivi indisponible."
          );
        }

        setData(body as StatusData);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Suivi indisponible."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    void load(false);

    const interval = window.setInterval(
      () => {
        void load(false);
      },
      30000
    );

    return () =>
      window.clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <section className="klyx-card mt-6 p-6">
        <div className="flex items-center gap-3 text-sm font-black text-muted-foreground">
          <LoaderCircle
            className="animate-spin"
            size={18}
          />
          KLYX vérifie la prochaine action...
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
        {errorMessage ||
          "Suivi indisponible."}
      </section>
    );
  }

  const finished =
    data.stage === "paid" ||
    data.stage === "completed";

  return (
    <section
      className={`klyx-card mt-6 p-6 sm:p-8 ${
        finished
          ? "border-emerald-500/20"
          : "border-violet-500/20"
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              finished
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-violet-500/10 text-violet-600"
            }`}
          >
            {finished ? (
              <CheckCircle2 size={21} />
            ) : data.stage ===
              "waiting_offers" ? (
              <Clock3 size={21} />
            ) : (
              <Sparkles size={21} />
            )}
          </div>

          <div>
            <p className="klyx-eyebrow">
              Copilote KLYX
            </p>

            <h2 className="mt-1 text-xl font-black">
              {data.title}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {data.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
              <span className="rounded-full bg-muted px-2.5 py-1">
                {data.offerCount} offre
                {data.offerCount > 1
                  ? "s"
                  : ""}
              </span>

              {data.bookingStatus && (
                <span className="rounded-full bg-muted px-2.5 py-1">
                  Réservation :{" "}
                  {data.bookingStatus}
                </span>
              )}

              {data.paymentStatus && (
                <span className="rounded-full bg-muted px-2.5 py-1">
                  Paiement :{" "}
                  {data.paymentStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() =>
            void load(true)
          }
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-black hover:bg-muted disabled:opacity-50"
        >
          {refreshing ? (
            <LoaderCircle
              className="animate-spin"
              size={15}
            />
          ) : (
            <RefreshCw size={15} />
          )}
          Actualiser
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href={data.nextHref}
          className="klyx-button"
        >
          {data.nextLabel}
          <ArrowRight size={17} />
        </Link>

        <Link
          href="/assistant/actions"
          className="klyx-button-secondary"
        >
          Voir toutes mes actions
        </Link>
      </div>

      {errorMessage && (
        <p className="mt-3 text-xs text-rose-600">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
