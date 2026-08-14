"use client";

import {
  Suspense,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  LoaderCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

// KLYX_MULTI_SLOT_CONFIRM_PAGE_12_83

type Slot = {
  date: string;
  startTime: string;
  endTime: string;
  budget: number | null;
  durationHours?: number | null;
};

type Schedule = {
  multiSlot: true;
  slots: Slot[];
  totals?: {
    totalHours?: number | null;
    totalBudget?: number | null;
  };
};

const labels:
  Record<string, string> = {
    babysitting:
      "Baby-sitting",
    cleaning:
      "Menage",
    moving:
      "Demenagement",
    handyman:
      "Bricolage",
  };

function duration(
  slot: Slot
) {
  if (
    slot.durationHours != null
  ) {
    return slot.durationHours;
  }

  const start =
    slot.startTime
      .split(":")
      .map(Number);

  const end =
    slot.endTime
      .split(":")
      .map(Number);

  let startMinutes =
    start[0] * 60 +
    start[1];

  let endMinutes =
    end[0] * 60 +
    end[1];

  if (
    endMinutes <=
    startMinutes
  ) {
    endMinutes += 1440;
  }

  return (
    Math.round(
      (
        (
          endMinutes -
          startMinutes
        ) /
        60
      ) *
        100
    ) / 100
  );
}

function MultiRequestContent() {
  const params =
    useSearchParams();

  const router =
    useRouter();

  const [
    publishing,
    setPublishing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const conversationId =
    params.get(
      "conversationId"
    ) ?? "";

  const confirmationId =
    params.get(
      "confirmationId"
    ) ?? "";

  const serviceSlug =
    params.get(
      "service"
    ) ?? "";

  const city =
    params.get(
      "city"
    ) ?? "";

  const schedule =
    useMemo<
      Schedule | null
    >(() => {
      const raw =
        params.get(
          "schedule"
        );

      if (!raw) {
        return null;
      }

      try {
        const parsed =
          JSON.parse(
            raw
          ) as Schedule;

        if (
          parsed.multiSlot !==
            true ||
          !Array.isArray(
            parsed.slots
          ) ||
          parsed.slots.length <
            2
        ) {
          return null;
        }

        return parsed;
      } catch {
        return null;
      }
    }, [params]);

  const totalHours =
    schedule
      ? schedule.slots.reduce(
          (total, slot) =>
            total +
            duration(slot),
          0
        )
      : 0;

  const budgetsComplete =
    Boolean(
      schedule &&
      schedule.slots.every(
        (slot) =>
          slot.budget != null
      )
    );

  const totalBudget =
    schedule &&
    budgetsComplete
      ? schedule.slots.reduce(
          (total, slot) =>
            total +
            (
              slot.budget ??
              0
            ),
          0
        )
      : null;

  async function publish() {
    if (
      !schedule ||
      !conversationId ||
      !confirmationId ||
      !serviceSlug ||
      !city
    ) {
      setErrorMessage(
        "La demande groupee est incomplete."
      );
      return;
    }

    setPublishing(true);
    setErrorMessage("");

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        !session?.access_token
      ) {
        router.replace(
          "/login"
        );
        return;
      }

      const serviceName =
        labels[serviceSlug] ??
        serviceSlug;

      const description =
        schedule.slots
          .map(
            (slot, index) =>
              String(
                index + 1
              ) +
              ". " +
              slot.date +
              " " +
              slot.startTime +
              "-" +
              slot.endTime +
              (
                slot.budget !=
                null
                  ? " | budget " +
                    slot.budget.toFixed(
                      2
                    ) +
                    " EUR"
                  : ""
              )
          )
          .join("\n");

      const response =
        await fetch(
          "/api/brain/market-publish-multi",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                "Bearer " +
                session.access_token,
            },
            body:
              JSON.stringify({
                conversationId,
                confirmationId,
                serviceSlug,
                city,
                title:
                  serviceName +
                  " - demande multi-creneaux",
                description:
                  "Demande groupee KLYX.\n\n" +
                  description,
                schedule,
                confirmed:
                  true,
              }),
          }
        );

      const result =
        (await response.json()) as {
          requestId?: string;
          href?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !result.requestId
      ) {
        throw new Error(
          result.error ||
            "Publication impossible."
        );
      }

      router.push(
        result.href ||
          "/requests"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Publication impossible."
      );

      setPublishing(false);
    }
  }

  if (!schedule) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
          Demande multi-creneaux introuvable.
        </div>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={15} />
            KLYX multi-creneaux
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Verifie tous les creneaux
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            KLYX va publier une seule demande et privilegier un prestataire capable de couvrir tous les horaires.
          </p>
        </section>

        <section className="mt-7 grid gap-4">
          {schedule.slots.map(
            (
              slot,
              index
            ) => (
              <article
                key={
                  slot.date +
                  slot.startTime +
                  String(index)
                }
                className="klyx-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="klyx-eyebrow">
                      Creneau{" "}
                      {index + 1}
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {slot.date}
                    </h2>
                  </div>

                  <CheckCircle2
                    className="text-emerald-600"
                    size={22}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Info
                    icon={
                      <Clock3
                        size={17}
                      />
                    }
                    label="Horaire"
                    value={
                      slot.startTime +
                      " - " +
                      slot.endTime
                    }
                  />

                  <Info
                    icon={
                      <CalendarDays
                        size={17}
                      />
                    }
                    label="Duree"
                    value={
                      duration(
                        slot
                      ).toFixed(
                        2
                      ) + " h"
                    }
                  />

                  <Info
                    icon={
                      <Euro
                        size={17}
                      />
                    }
                    label="Budget"
                    value={
                      slot.budget !=
                      null
                        ? slot.budget.toFixed(
                            2
                          ) +
                          " EUR"
                        : "Non defini"
                    }
                  />
                </div>
              </article>
            )
          )}
        </section>

        <section className="klyx-card mt-6 p-6">
          <div className="flex items-center gap-3">
            <UsersRound
              className="text-violet-600"
              size={24}
            />

            <div>
              <p className="font-black">
                Priorite : meme prestataire
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                KLYX compare disponibilites et reservations sur tous les creneaux.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info
              icon={
                <Clock3
                  size={17}
                />
              }
              label="Total"
              value={
                totalHours.toFixed(
                  2
                ) + " h"
              }
            />

            <Info
              icon={
                <Euro
                  size={17}
                />
              }
              label="Budget total"
              value={
                totalBudget !=
                null
                  ? totalBudget.toFixed(
                      2
                    ) +
                    " EUR"
                  : "Partiellement defini"
              }
            />
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            disabled={
              publishing
            }
            onClick={() =>
              void publish()
            }
            className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 font-black text-white disabled:opacity-50"
          >
            {publishing ? (
              <>
                <LoaderCircle
                  className="animate-spin"
                  size={19}
                />
                Publication...
              </>
            ) : (
              <>
                <CheckCircle2
                  size={19}
                />
                Publier cette demande groupee
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Aucune reservation et aucun paiement ne seront executes automatiquement.
          </p>
        </section>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-2 font-black">
        {value}
      </p>
    </div>
  );
}

export default function MultiRequestConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page grid min-h-72 place-items-center">
          <LoaderCircle
            className="animate-spin text-violet-600"
            size={34}
          />
        </main>
      }
    >
      <MultiRequestContent />
    </Suspense>
  );
}