"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Euro,
  Layers3,
  LoaderCircle,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_PROVIDER_MULTI_JOBS_UI_12_93

type MultiSlot = {
  id: string;

  position:
    number;

  date:
    string;

  startTime:
    | string
    | null;

  endTime:
    | string
    | null;

  budgetMax:
    | number
    | null;

  durationMinutes:
    | number
    | null;
};

type MarketRequest = {
  id: string;

  title: string;

  description:
    string;

  city:
    string;

  requested_date:
    | string
    | null;

  requested_time:
    | string
    | null;

  budget_max:
    | number
    | null;

  requestMode:
    | "single"
    | "multi_slot";

  slotCount:
    number;

  budgetTotal:
    | number
    | null;

  preferSingleProvider:
    boolean;

  totalDurationMinutes:
    | number
    | null;

  slots:
    MultiSlot[];

  coverage:
    | {
        count: number;
        total: number;
        fullCoverage: boolean;
        label: string;
      }
    | null;

  service:
    | {
        name?: string | null;
        slug?: string;
      }
    | null;

  match:
    | {
        score: number;
        reasons: string[];
        locationMatch?: boolean;
        availabilityMatch?: boolean;
        budgetMatch?: boolean | null;
      }
    | null;

  myOffer:
    | {
        id: string;
        amount: number;
        message: string | null;
        status: string;
      }
    | null;
};

type ProviderJobsResponse = {
  requests?:
    MarketRequest[];

  count?:
    number;

  multiSlotAware?:
    boolean;

  fullCoverageOnly?:
    boolean;

  automaticExecutionAllowed?:
    boolean;

  error?:
    string;
};

async function token() {
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

function matchLabel(
  score: number
) {
  if (
    score >= 90
  ) {
    return "Excellent match";
  }

  if (
    score >= 80
  ) {
    return "Tres bon match";
  }

  if (
    score >= 70
  ) {
    return "Bon match";
  }

  if (
    score >= 60
  ) {
    return "Compatible";
  }

  return "A etudier";
}

function dateLabel(
  value: string
) {
  return new Intl.DateTimeFormat(
    "fr-BE",
    {
      weekday:
        "short",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    new Date(
      value +
      "T12:00:00"
    )
  );
}

function timeLabel(
  value:
    | string
    | null
) {
  if (!value) {
    return "--:--";
  }

  return value.slice(
    0,
    5
  );
}

function money(
  value:
    | number
    | null
) {
  if (
    value === null
  ) {
    return "Non precise";
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency:
        "EUR",
    }
  ).format(
    value
  );
}

function durationLabel(
  minutes:
    | number
    | null
) {
  if (
    minutes === null ||
    minutes <= 0
  ) {
    return "Duree a confirmer";
  }

  const hours =
    Math.floor(
      minutes /
      60
    );

  const remainder =
    minutes %
    60;

  if (
    hours > 0 &&
    remainder > 0
  ) {
    return (
      String(
        hours
      ) +
      " h " +
      String(
        remainder
      ) +
      " min"
    );
  }

  if (
    hours > 0
  ) {
    return (
      String(
        hours
      ) +
      " h"
    );
  }

  return (
    String(
      remainder
    ) +
    " min"
  );
}

export default function ProviderJobsPage() {
  const [
    requests,
    setRequests,
  ] =
    useState<
      MarketRequest[]
    >([]);

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
      ""
    );

  const [
    amounts,
    setAmounts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    messages,
    setMessages,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  const [
    successMessage,
    setSuccessMessage,
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
          const accessToken =
            await token();

          const response =
            await fetch(
              "/api/provider/jobs",
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
            (await response.json()) as
              ProviderJobsResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
              "Chargement impossible."
            );
          }

          const rows =
            body.requests ??
            [];

          setRequests(
            rows
          );

          const nextAmounts:
            Record<
              string,
              string
            > = {};

          const nextMessages:
            Record<
              string,
              string
            > = {};

          for (
            const row
            of rows
          ) {
            if (
              row.myOffer
            ) {
              nextAmounts[
                row.id
              ] =
                String(
                  row.myOffer.amount
                );

              nextMessages[
                row.id
              ] =
                row.myOffer.message ??
                "";
            }
          }

          setAmounts(
            nextAmounts
          );

          setMessages(
            nextMessages
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
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  const counts =
    useMemo(
      () => ({
        total:
          requests.length,

        multi:
          requests.filter(
            (item) =>
              item.requestMode ===
              "multi_slot"
          ).length,

        offered:
          requests.filter(
            (item) =>
              Boolean(
                item.myOffer
              )
          ).length,
      }),
      [
        requests,
      ]
    );

  async function submitOffer(
    event:
      FormEvent<HTMLFormElement>,

    request:
      MarketRequest
  ) {
    event.preventDefault();

    setBusy(
      request.id
    );

    setErrorMessage(
      ""
    );

    setSuccessMessage(
      ""
    );

    try {
      const accessToken =
        await token();

      if (
        request.requestMode ===
          "multi_slot" &&
        !request.coverage
          ?.fullCoverage
      ) {
        throw new Error(
          "Cette mission exige une couverture complete de tous les creneaux."
        );
      }

      const amount =
        Number(
          amounts[
            request.id
          ]
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        throw new Error(
          "Entre un montant superieur a 0."
        );
      }

      const response =
        await fetch(
          "/api/market/requests/" +
            request.id +
            "/offers",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                accessToken,
            },

            body:
              JSON.stringify({
                amount,

                message:
                  messages[
                    request.id
                  ] ??
                  "",
              }),
          }
        );

      const body =
        (await response.json()) as {
          message?:
            string;

          error?:
            string;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          body.error ||
          "Offre impossible."
        );
      }

      setSuccessMessage(
        body.message ||
        (
          request.requestMode ===
          "multi_slot"
            ? "Offre totale envoyee pour tous les creneaux."
            : "Offre envoyee."
        )
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Offre impossible."
      );
    } finally {
      setBusy(
        ""
      );
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
          Opportunites KLYX
        </p>

        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          Missions recommandees pour toi
        </h1>

        <p className="mt-3 max-w-3xl text-muted-foreground">
          Les missions multi-creneaux apparaissent seulement
          lorsque ton planning permet de couvrir tous les creneaux.
          Une seule offre fixe ton prix pour la mission complete.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Stat
            label="Missions"
            value={
              String(
                counts.total
              )
            }
          />

          <Stat
            label="Multi-creneaux"
            value={
              String(
                counts.multi
              )
            }
          />

          <Stat
            label="Offres envoyees"
            value={
              String(
                counts.offered
              )
            }
          />
        </div>

        {successMessage && (
          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            {
              successMessage
            }
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {
              errorMessage
            }
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle
              className="animate-spin text-blue-600"
              size={36}
            />
          </div>
        ) : requests.length ===
          0 ? (
          <div className="klyx-card mt-7 p-8 text-center">
            <ShieldCheck
              className="mx-auto text-violet-600"
              size={42}
            />

            <h2 className="mt-4 text-xl font-black">
              Aucune mission compatible
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Pour une mission multi-creneaux, KLYX attend que tu
              sois disponible sur tous les creneaux avant de te la
              proposer.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5">
            {requests.map(
              (
                item
              ) => (
                <article
                  key={
                    item.id
                  }
                  className="klyx-card p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                          {
                            item.service
                              ?.name ??
                            "Service KLYX"
                          }
                        </p>

                        {item.requestMode ===
                          "multi_slot" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-700 dark:text-violet-300">
                            <Layers3
                              size={13}
                            />

                            {
                              item.slotCount
                            }
                            {" creneaux"}
                          </span>
                        )}

                        {item.coverage
                          ?.fullCoverage && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                            <BadgeCheck
                              size={13}
                            />

                            {
                              item.coverage
                                .label
                            }
                            {" disponible"}
                          </span>
                        )}

                        {item.match && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-700 dark:text-violet-300">
                            <Sparkles
                              size={13}
                            />

                            {
                              item.match.score
                            }
                            %
                            {" · "}
                            {matchLabel(
                              item.match.score
                            )}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2 text-2xl font-black">
                        {
                          item.title
                        }
                      </h2>

                      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin
                          size={16}
                        />

                        {
                          item.city
                        }
                      </p>

                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        {
                          item.description
                        }
                      </p>

                      {item.match &&
                        item.match.reasons
                          .length >
                          0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.match.reasons.map(
                            (
                              reason
                            ) => (
                              <span
                                key={
                                  reason
                                }
                                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-bold"
                              >
                                <BadgeCheck
                                  size={13}
                                />

                                {
                                  reason
                                }
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-48 rounded-2xl border border-border bg-background p-4 text-right">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                        {item.requestMode ===
                        "multi_slot"
                          ? "Budget total"
                          : "Budget client"}
                      </p>

                      <p className="mt-1 text-2xl font-black">
                        {money(
                          item.requestMode ===
                          "multi_slot"
                            ? item.budgetTotal
                            : item.budget_max
                        )}
                      </p>

                      {item.requestMode ===
                        "multi_slot" &&
                        item.totalDurationMinutes !==
                          null && (
                        <p className="mt-2 text-xs font-bold text-muted-foreground">
                          {durationLabel(
                            item.totalDurationMinutes
                          )}
                          {" au total"}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.requestMode ===
                  "multi_slot" ? (
                    <section className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck
                          className="mt-0.5 shrink-0 text-violet-600"
                          size={20}
                        />

                        <div>
                          <p className="font-black">
                            Tu couvres toute la mission
                          </p>

                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Ton offre sera un prix unique pour les{" "}
                            {
                              item.slotCount
                            }
                            {" creneaux."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 lg:grid-cols-2">
                        {item.slots.map(
                          (
                            slot
                          ) => (
                            <div
                              key={
                                slot.id
                              }
                              className="rounded-2xl border border-border bg-background p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-600">
                                    Creneau{" "}
                                    {
                                      slot.position
                                    }
                                  </p>

                                  <p className="mt-1 font-black">
                                    {dateLabel(
                                      slot.date
                                    )}
                                  </p>
                                </div>

                                {slot.budgetMax !==
                                  null && (
                                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
                                    {money(
                                      slot.budgetMax
                                    )}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <MiniInfo
                                  icon={
                                    <Clock3
                                      size={15}
                                    />
                                  }
                                  label="Horaire"
                                  value={
                                    timeLabel(
                                      slot.startTime
                                    ) +
                                    " - " +
                                    timeLabel(
                                      slot.endTime
                                    )
                                  }
                                />

                                <MiniInfo
                                  icon={
                                    <CalendarDays
                                      size={15}
                                    />
                                  }
                                  label="Duree"
                                  value={durationLabel(
                                    slot.durationMinutes
                                  )}
                                />
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {item.requested_date && (
                        <MiniInfo
                          icon={
                            <CalendarDays
                              size={15}
                            />
                          }
                          label="Date"
                          value={dateLabel(
                            item.requested_date
                          )}
                        />
                      )}

                      {item.requested_time && (
                        <MiniInfo
                          icon={
                            <Clock3
                              size={15}
                            />
                          }
                          label="Heure"
                          value={timeLabel(
                            item.requested_time
                          )}
                        />
                      )}
                    </div>
                  )}

                  <form
                    onSubmit={(
                      event
                    ) =>
                      void submitOffer(
                        event,
                        item
                      )
                    }
                    className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-[200px_1fr_auto]"
                  >
                    <label>
                      <span className="mb-2 flex items-center gap-2 text-sm font-black">
                        <Euro
                          size={16}
                        />

                        {item.requestMode ===
                        "multi_slot"
                          ? "Ton prix total"
                          : "Ton prix"}
                      </span>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="klyx-input"
                        value={
                          amounts[
                            item.id
                          ] ??
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          setAmounts(
                            (
                              current
                            ) => ({
                              ...current,

                              [item.id]:
                                event.target
                                  .value,
                            })
                          )
                        }
                        required
                      />
                    </label>

                    <label>
                      <span className="mb-2 block text-sm font-black">
                        Message au client
                      </span>

                      <input
                        className="klyx-input"
                        maxLength={
                          1500
                        }
                        value={
                          messages[
                            item.id
                          ] ??
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          setMessages(
                            (
                              current
                            ) => ({
                              ...current,

                              [item.id]:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder={
                          item.requestMode ===
                          "multi_slot"
                            ? "Confirme que ton prix couvre tous les creneaux."
                            : "Explique pourquoi tu corresponds a cette mission."
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={
                        busy ===
                          item.id ||
                        (
                          item.requestMode ===
                            "multi_slot" &&
                          !item.coverage
                            ?.fullCoverage
                        )
                      }
                      className="klyx-button self-end disabled:opacity-50"
                    >
                      {busy ===
                      item.id ? (
                        <LoaderCircle
                          className="animate-spin"
                          size={17}
                        />
                      ) : (
                        <Send
                          size={17}
                        />
                      )}

                      {item.myOffer
                        ? "Mettre a jour"
                        : item.requestMode ===
                            "multi_slot"
                          ? "Proposer pour tout"
                          : "Envoyer l offre"}
                    </button>
                  </form>

                  {item.myOffer && (
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Offre actuelle :
                      {" "}
                      {
                        item.myOffer.status
                      }
                      {" · "}
                      {money(
                        Number(
                          item.myOffer.amount
                        )
                      )}
                    </p>
                  )}
                </article>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-full border border-border bg-card px-4 py-2 text-sm">
      <span className="font-black">
        {value}
      </span>

      <span className="ml-2 text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon:
    ReactNode;

  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-1 text-sm font-black">
        {value}
      </p>
    </div>
  );
}