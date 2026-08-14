"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import {
  ArrowRight,
  LoaderCircle,
  UsersRound,
} from "lucide-react";
import {
  useParams,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_MULTI_PROVIDER_REVIEW_ENTRY_13_17

type SlotMapResponse = {
  splitPlanPossible?:
    boolean;

  singleProviderFullCoverage?:
    boolean;

  slotCount?:
    number;

  assignments?:
    unknown[];
};

function requestIdFromParams(
  value:
    string |
    string[] |
    undefined
): string {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value[0] ??
      "";
  }

  return "";
}

export default function SplitPlanEntryCard() {
  const params =
    useParams();

  const requestId =
    requestIdFromParams(
      params.id
    );

  const [
    state,
    setState,
  ] =
    useState<
      "loading" |
      "hidden" |
      "available"
    >(
      "loading"
    );

  const [
    slotCount,
    setSlotCount,
  ] =
    useState(
      0
    );

  const [
    providerCount,
    setProviderCount,
  ] =
    useState(
      0
    );

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        if (
          !requestId
        ) {
          if (
            active
          ) {
            setState(
              "hidden"
            );
          }

          return;
        }

        try {
          const {
            data:
              sessionData,
          } =
            await supabase.auth.getSession();

          const accessToken =
            sessionData.session?.access_token;

          if (
            !accessToken
          ) {
            if (
              active
            ) {
              setState(
                "hidden"
              );
            }

            return;
          }

          const response =
            await fetch(
              "/api/market/requests/" +
              encodeURIComponent(
                requestId
              ) +
              "/split-fallback/slot-map",
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

          if (
            !response.ok
          ) {
            if (
              active
            ) {
              setState(
                "hidden"
              );
            }

            return;
          }

          const body =
            (
              await response.json()
            ) as SlotMapResponse;

          /*
            Le CTA apparait uniquement quand
            13.16 a PROUVE un vrai plan split.

            Si un prestataire unique couvre N/N,
            le parcours historique reste prioritaire.
          */
          if (
            body.splitPlanPossible !==
              true ||
            body.singleProviderFullCoverage ===
              true
          ) {
            if (
              active
            ) {
              setState(
                "hidden"
              );
            }

            return;
          }

          if (
            active
          ) {
            setSlotCount(
              Number(
                body.slotCount ??
                0
              )
            );

            setProviderCount(
              Array.isArray(
                body.assignments
              )
                ? body.assignments.length
                : 0
            );

            setState(
              "available"
            );
          }
        }
        catch {
          if (
            active
          ) {
            setState(
              "hidden"
            );
          }
        }
      }

      void load();

      return () => {
        active =
          false;
      };
    },
    [
      requestId,
    ]
  );

  if (
    state ===
    "loading"
  ) {
    return (
      <section className="klyx-card mt-6 flex items-center gap-3 p-5">
        <LoaderCircle
          className="animate-spin text-violet-500"
          size={19}
        />

        <p className="text-sm text-muted-foreground">
          KLYX vérifie si plusieurs prestataires peuvent couvrir cette mission.
        </p>
      </section>
    );
  }

  if (
    state !==
    "available"
  ) {
    return null;
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet-500/20 bg-violet-500/10 p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
            <UsersRound
              size={23}
            />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
              Solution multi-prestataires
            </p>

            <h2 className="mt-2 text-xl font-black">
              KLYX a trouvé une combinaison complète
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {slotCount} créneau
              {slotCount > 1
                ? "x"
                : ""} peuvent être couverts par{" "}
              {providerCount} prestataire
              {providerCount > 1
                ? "s"
                : ""}.
              Aucun prestataire n'a encore été sélectionné.
            </p>
          </div>
        </div>

        <Link
          href={
            "/assistant/market/" +
            encodeURIComponent(
              requestId
            ) +
            "/split-plan"
          }
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
        >
          Voir le plan

          <ArrowRight
            size={17}
          />
        </Link>
      </div>
    </section>
  );
}