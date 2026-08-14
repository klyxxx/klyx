// KLYX_LIVE_ADVICE_CLIENT_12_99
"use client";

import SplitPlanEntryCard from "./SplitPlanEntryCard";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Euro,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MarketStatusTracker from "./MarketStatusTracker";

type AdviceOffer = {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  providerId: string;
  providerName: string;
  avatarUrl: string | null;
  stats: {
    klyxScore: number;
    rating: number;
    reviewCount: number;
    yearsExperience: number;
    isVerified: boolean;
  };
  ranking: {
    score: number;
    reasons: string[];
    priceScore: number;
    trustScore: number;
  };
  isRecommended: boolean;
  isCheapest: boolean;
  coverage: {
    count: number;
    total: number;
    fullCoverage: boolean;
    label: string;
  };
};

type AdviceResponse = {
  request: {
    id: string;
    title: string;
    serviceName: string;
    city: string;
    budgetMax: number | null;
    budgetTotal: number | null;
    requestMode: "single" | "multi_slot";
    slotCount: number;
    preferSingleProvider: boolean;
    slots: Array<{
      position: number;
      date: string;
      startTime: string;
      endTime: string;
      budget: number | null;
      durationMinutes: number;
    }>;
    status: string;
  };
  offers: AdviceOffer[];
  recommendation: {
    offerId: string;
    providerId: string;
    providerName: string;
    score: number;
    amount: number;
  } | null;
  summary: string;
  liveCoverageChecked?:
    boolean;

  staleOffersRemoved?:
    number;

  automaticSelection?:
    boolean;
};

type PendingChoice = {
  offerId: string;
  providerName: string;
  amount: number;
} | null;

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function MarketAdvicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] =
    useState<AdviceResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [busyOfferId, setBusyOfferId] =
    useState("");
  const [pendingChoice, setPendingChoice] =
    useState<PendingChoice>(null);
  const [errorMessage, setErrorMessage] =
    useState("");

// KLYX_LIVE_ADVICE_CLIENT_STATE_12_99
  const [
    liveAdvice,
    setLiveAdvice,
  ] =
    useState<{
      checked:
        boolean;

      staleOffersRemoved:
        number;

      refreshedAt:
        string |
        null;
    }>({
      checked:
        false,

      staleOffersRemoved:
        0,

      refreshedAt:
        null,
    });

  async function load(
    options?: {
      silent?:
        boolean;
    }
  ) {
    // KLYX_LIVE_ADVICE_SILENT_LOAD_12_99
    const silent =
      Boolean(
        options?.silent
      );

    if (!silent) {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );
    }

    try {
      const accessToken = await token();

      const response = await fetch(
        `/api/brain/market-advice/${params.id}`,
        {
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

      const body = (await response.json()) as
        | AdviceResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in body
            ? body.error ||
                "Analyse impossible."
            : "Analyse impossible."
        );
      }

      // KLYX_LIVE_ADVICE_PAYLOAD_12_99
      const advice =
        body as AdviceResponse;

      setData(
        advice
      );

      if (
        advice.liveCoverageChecked
      ) {
        setLiveAdvice({
          checked:
            true,

          staleOffersRemoved:
            Number(
              advice.staleOffersRemoved ??
              0
            ),

          refreshedAt:
            new Date()
              .toISOString(),
        });
      }
    } catch (error) {
      // KLYX_LIVE_ADVICE_SILENT_ERROR_12_99
      if (silent) {
        return;
      }
      if (
        error instanceof Error &&
        error.message ===
          "Session manquante."
      ) {
        router.replace("/login");
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Analyse impossible."
      );
    } finally {
      // KLYX_LIVE_ADVICE_LOADING_FIX_12_99
      if (!silent) {
        setLoading(
          false
        );
      }
    }
  }

  // KLYX_LIVE_ADVICE_AUTO_REFRESH_12_99
  useEffect(() => {
    void load();

    const intervalId =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void load({
              silent:
                true,
            });
          }
        },
        15000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [params.id]);

  function prepareChoice(offer: AdviceOffer) {
    if (
      data?.request.status !== "open" ||
      offer.status !== "sent"
    ) {
      setErrorMessage(
        "Cette offre ne peut plus être sélectionnée."
      );
      return;
    }

    if (
      data.request.requestMode === "multi_slot" &&
      !offer.coverage.fullCoverage
    ) {
      setErrorMessage(
        "Ce prestataire ne couvre pas tous les créneaux. KLYX ne peut pas créer une réservation groupée complète avec cette offre."
      );
      return;
    }

    setErrorMessage("");
    setPendingChoice({
      offerId: offer.id,
      providerName: offer.providerName,
      amount: offer.amount,
    });
  }

  async function confirmChoice() {
    if (!pendingChoice || busyOfferId) {
      return;
    }

    setBusyOfferId(
      pendingChoice.offerId
    );
    setErrorMessage("");

    try {
      const accessToken =
        await token();

      if (
        data?.request.requestMode ===
        "multi_slot"
      ) {
        const response =
          await fetch(
            `/api/market/requests/${params.id}/group-booking`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${accessToken}`,
              },
              body:
                JSON.stringify({
                  offerId:
                    pendingChoice.offerId,
                }),
            }
          );

        const body =
          (await response.json()) as {
            groupId?: string;
            href?: string;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Impossible de créer la réservation groupée."
          );
        }

        if (!body.groupId) {
          throw new Error(
            "Identifiant de réservation groupée manquant."
          );
        }

        setPendingChoice(
          null
        );

        router.push(
          body.href ||
            `/booking-groups/${body.groupId}`
        );

        return;
      }

      const response =
        await fetch(
          `/api/market/requests/${params.id}/offers`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${accessToken}`,
            },
            body:
              JSON.stringify({
                offerId:
                  pendingChoice.offerId,
                action:
                  "accept",
              }),
          }
        );

      const body =
        (await response.json()) as {
          quoteId?: string;
          bookingHref?: string;
          message?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Impossible d’accepter cette offre."
        );
      }

      setPendingChoice(
        null
      );

      if (
        body.bookingHref
      ) {
        router.push(
          body.bookingHref
        );
        return;
      }

      if (body.quoteId) {
        router.push(
          `/quotes/${body.quoteId}/book`
        );
        return;
      }

      router.push(
        "/requests"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’accepter cette offre."
      );
    } finally {
      setBusyOfferId("");
    }
  }
  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={38}
        />
      </main>
    );
  }

  if (errorMessage && !data) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/requests"
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Retour aux demandes
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={14} />
            Conseiller KLYX
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            KLYX compare. Tu confirmes. KLYX agit.
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {data.request.serviceName} ·{" "}
            {data.request.city}
          </p>
        </section>

        <MarketStatusTracker requestId={params.id} />
        {/* KLYX_LIVE_ADVICE_BADGE_12_99 */}
        {liveAdvice.checked && (
          <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-emerald-600"
              />

              <div>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                  Disponibilites revalidees en direct
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {liveAdvice.staleOffersRemoved > 0
                    ? String(
                        liveAdvice.staleOffersRemoved
                      ) +
                      " prestataire(s) devenu(s) indisponible(s) ont ete retires du classement."
                    : "Tous les prestataires affiches couvrent encore la mission."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={Boolean(busyOfferId)}
              onClick={() =>
                void load({
                  silent:
                    true,
                })
              }
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-background px-4 text-xs font-black transition hover:bg-muted disabled:opacity-50"
            >
              Revalider maintenant
            </button>
          </section>
        )}

        {/* KLYX_MULTI_SLOT_ADVICE_UI_12_84 */}
        {data.request.requestMode === "multi_slot" && (
          <section className="klyx-card mt-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="klyx-eyebrow">
                  Demande groupee
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {data.request.slotCount} creneaux a couvrir
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  KLYX classe d abord les prestataires capables de couvrir toute la mission.
                </p>
              </div>

              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-700 dark:text-violet-300">
                Meme prestataire prioritaire
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.request.slots.map((slot) => (
                <div
                  key={String(slot.position)}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Creneau {slot.position}
                  </p>

                  <p className="mt-2 font-black">
                    {slot.date}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {slot.startTime} - {slot.endTime}
                    {" · "}
                    {(slot.durationMinutes / 60).toFixed(2)} h
                  </p>

                  {slot.budget !== null && (
                    <p className="mt-2 text-sm font-black text-violet-600">
                      Budget {slot.budget.toFixed(2)} EUR
                    </p>
                  )}
                </div>
              ))}
            </div>

            {data.request.budgetTotal !== null && (
              <p className="mt-5 inline-flex rounded-full bg-muted px-3 py-1.5 text-sm font-black">
                Budget total : {data.request.budgetTotal.toFixed(2)} EUR
              </p>
            )}
          </section>
        )}
        <section className="klyx-card mt-6 border-violet-500/20 p-6 sm:p-8">
          <p className="klyx-eyebrow">
            Analyse KLYX
          </p>

          <h2 className="mt-2 text-2xl font-black">
            {data.request.title}
          </h2>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
            {data.summary}
          </p>

          {data.request.budgetMax !== null && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-black">
              <Euro size={15} />
              Budget :{" "}
              {data.request.budgetMax.toFixed(
                2
              )}{" "}
              €
            </p>
          )}
        </section>

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {data.offers.length === 0 ? (
          <section className="klyx-card mt-6 p-8 text-center">
            <p className="font-black">
              Aucune offre à comparer
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Reviens lorsque des prestataires
              auront répondu.
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4">
            {data.offers.map(
              (offer, index) => (
                <article
                  key={offer.id}
                  className={`klyx-card p-6 ${
                    offer.isRecommended
                      ? "border-violet-500/30"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                          #{index + 1}
                        </span>

                        <h3 className="text-xl font-black">
                          {offer.providerName}
                        </h3>

                        {offer.isRecommended && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-black text-white">
                            <Sparkles size={12} />
                            Recommandé
                          </span>
                        )}

                        {offer.isCheapest && (
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                            Moins cher
                          </span>
                        )}

                        {data.request.requestMode === "multi_slot" && (
                          <span
                            className={
                              offer.coverage.fullCoverage
                                ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300"
                                : "inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-300"
                            }
                          >
                            <Check size={12} />
                            {offer.coverage.label}
                          </span>
                        )}

                        {offer.stats.isVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-300">
                            <BadgeCheck size={12} />
                            Vérifié
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        {offer.message ||
                          "Aucun message du prestataire."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-muted px-2.5 py-1 font-bold">
                          Score KLYX{" "}
                          {Math.round(
                            offer.stats.klyxScore
                          )}
                        </span>

                        {offer.stats.reviewCount >
                          0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-bold">
                            <Star size={12} />
                            {offer.stats.rating.toFixed(
                              1
                            )}{" "}
                            ·{" "}
                            {
                              offer.stats
                                .reviewCount
                            }{" "}
                            avis
                          </span>
                        )}

                        {offer.stats
                          .yearsExperience > 0 && (
                          <span className="rounded-full bg-muted px-2.5 py-1 font-bold">
                            {
                              offer.stats
                                .yearsExperience
                            }{" "}
                            an
                            {offer.stats
                              .yearsExperience >
                            1
                              ? "s"
                              : ""}{" "}
                            d’expérience
                          </span>
                        )}
                      </div>

                      {offer.ranking.reasons
                        .length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {offer.ranking.reasons.map(
                            (reason) => (
                              <span
                                key={reason}
                                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground"
                              >
                                {reason}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-left lg:text-right">
                      <p className="text-3xl font-black text-violet-600">
                        {offer.amount.toFixed(2)} €
                      </p>

                      <p className="mt-1 text-xs font-black text-muted-foreground">
                        Recommandation{" "}
                        {offer.ranking.score}/100
                      </p>

                      {/* KLYX_GROUP_SELECTION_UI_12_85 */}
                      {data.request.requestMode === "multi_slot" &&
                      data.request.status === "open" &&
                      offer.status === "sent" &&
                      offer.coverage.fullCoverage ? (
                        <button
                          type="button"
                          disabled={Boolean(busyOfferId)}
                          onClick={() =>
                            prepareChoice(offer)
                          }
                          className="klyx-button mt-4"
                        >
                          <Check size={17} />
                          Choisir tous les creneaux
                        </button>
                      ) : data.request.requestMode === "multi_slot" &&
                        data.request.status === "open" &&
                        offer.status === "sent" ? (
                        <button
                          type="button"
                          disabled
                          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted px-4 text-sm font-black text-muted-foreground"
                        >
                          <ShieldCheck size={17} />
                          Couverture incomplete
                        </button>
                      ) : data.request.status ===
                          "open" &&
                        offer.status === "sent" ? (
                        <button
                          type="button"
                          disabled={
                            Boolean(busyOfferId)
                          }
                          onClick={() =>
                            prepareChoice(offer)
                          }
                          className="klyx-button mt-4"
                        >
                          <Check size={17} />
                          Choisir avec KLYX
                        </button>
                      ) : (
                        <span className="mt-4 inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground">
                          {offer.status}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            )}
          </section>
        )}

        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm leading-6 text-muted-foreground">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-blue-600"
              size={18}
            />
            <p>
              KLYX peut préparer et exécuter ton choix,
              mais seulement après ta confirmation explicite.
              Le paiement reste une étape séparée.
            </p>
          </div>
        </div>
      </div>

      {pendingChoice && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
              <Sparkles size={22} />
            </div>

            <h2 className="mt-5 text-2xl font-black">
              Confirmer ce prestataire ?
            </h2>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Tu vas accepter l’offre de{" "}
              <strong className="text-foreground">
                {pendingChoice.providerName}
              </strong>{" "}
              pour{" "}
              <strong className="text-foreground">
                {pendingChoice.amount.toFixed(
                  2
                )}{" "}
                €
              </strong>
              . KLYX créera ensuite le devis de
              réservation et t’enverra vers le choix
              du créneau.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={Boolean(busyOfferId)}
                onClick={() =>
                  setPendingChoice(null)
                }
                className="klyx-button-secondary flex-1"
              >
                <X size={17} />
                Annuler
              </button>

              <button
                type="button"
                disabled={Boolean(busyOfferId)}
                onClick={() =>
                  void confirmChoice()
                }
                className="klyx-button flex-1"
              >
                {busyOfferId ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={17}
                  />
                ) : (
                  <Check size={17} />
                )}
                Confirmer mon choix
              </button>
            </div>
          </section>
        </div>
      )}
          {/* KLYX_MULTI_PROVIDER_REVIEW_WIRING_13_17 */}
      <SplitPlanEntryCard />

</main>
  );
}
