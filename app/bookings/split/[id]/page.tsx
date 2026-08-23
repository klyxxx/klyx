"use client";

import SplitMissionRefundStatus from "./SplitMissionRefundStatus";
import SplitMissionCheckout from "./SplitMissionCheckout";
import SplitMissionPaymentConfirmation from "./SplitMissionPaymentConfirmation";
import SplitMissionStripeReadiness from "./SplitMissionStripeReadiness";
import SplitMissionPaymentPlan from "./SplitMissionPaymentPlan";
import SplitMissionPriceConfirmation from "./SplitMissionPriceConfirmation";
import SplitMissionAcceptance from "./SplitMissionAcceptance";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  LoaderCircle,
  RefreshCw,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  useParams,
} from "next/navigation";

import {
  useKlyxLocale,
} from "@/app/components/KlyxLocaleProvider";

import {
  formatKlyxSplitBookingStatus,
  formatKlyxSplitMissionDetailDate,
  formatKlyxSplitMissionProviderCount,
  formatKlyxSplitMissionService,
  formatKlyxSplitMissionSlotCount,
  formatKlyxSplitMissionSlotPosition,
  formatKlyxSplitMissionStatus,
  translateKlyxSplitMission,
  type KlyxSplitMissionMessageKey,
} from "@/lib/klyx-split-mission-i18n";

import {
  supabase,
} from "@/lib/supabase";

import type {
  SplitMissionSummary,
} from "../../SplitMissionSection";

// KLYX_SPLIT_MISSION_DETAIL_13_21
// KLYX_SPLIT_MISSION_DETAIL_I18N_16_09

const SPLIT_SESSION_MISSING =
  "KLYX_SPLIT_SESSION_MISSING";
const SPLIT_UNAVAILABLE =
  "KLYX_SPLIT_UNAVAILABLE";
const SPLIT_LOAD_FAILED =
  "KLYX_SPLIT_LOAD_FAILED";

type ApiResponse = {
  missions?:
    SplitMissionSummary[];

  error?:
    string;

  code?:
    string;
};

export default function SplitMissionDetailPage() {
  const params =
    useParams<{
      id:
        string;
    }>();

  const {
    locale,
  } =
    useKlyxLocale();

  const t =
    (
      key:
        KlyxSplitMissionMessageKey
    ) =>
      translateKlyxSplitMission(
        locale,
        key
      );

  const batchId =
    typeof params.id ===
      "string"
      ? params.id
      : "";

  const [
    mission,
    setMission,
  ] =
    useState<
      SplitMissionSummary |
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
    errorKey,
    setErrorKey,
  ] =
    useState<
      KlyxSplitMissionMessageKey |
      null
    >(
      null
    );

  const load =
    useCallback(
      async () => {
        if (
          !batchId
        ) {
          setMission(
            null
          );
          setErrorKey(
            "detailUnavailable"
          );
          setLoading(
            false
          );
          return;
        }

        setLoading(
          true
        );

        setErrorKey(
          null
        );

        try {
          const {
            data,
          } =
            await supabase.auth.getSession();

          const token =
            data.session
              ?.access_token;

          if (
            !token
          ) {
            throw new Error(
              SPLIT_SESSION_MISSING
            );
          }

          const response =
            await fetch(
              "/api/bookings/split-missions?batchId=" +
                encodeURIComponent(
                  batchId
                ),
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
            ) as ApiResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              SPLIT_LOAD_FAILED
            );
          }

          const first =
            body.missions
              ?.[0] ??
            null;

          if (
            !first
          ) {
            throw new Error(
              SPLIT_UNAVAILABLE
            );
          }

          setMission(
            first
          );
        }
        catch (
          error
        ) {
          setMission(
            null
          );

          const message =
            error instanceof Error
              ? error.message
              : "";

          setErrorKey(
            message ===
              SPLIT_SESSION_MISSING
              ? "detailSessionMissing"
              : message ===
                  SPLIT_UNAVAILABLE
                ? "detailUnavailable"
                : "detailLoadFailed"
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

  if (
    loading
  ) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle
          className="animate-spin text-violet-500"
          size={30}
        />
      </main>
    );
  }

  if (
    !mission
  ) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-4xl py-10">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 text-sm font-black"
          >
            <ArrowLeft
              size={16}
            />
            {t(
              "detailBackToBookings"
            )}
          </Link>

          <div className="klyx-card mt-8 p-7">
            <AlertTriangle
              className="text-rose-500"
              size={28}
            />

            <p className="mt-4 font-black">
              {t(
                errorKey ??
                  "detailUnavailable"
              )}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground"
          >
            <ArrowLeft
              size={16}
            />

            {t(
              "detailBackToBookings"
            )}
          </Link>

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

            {t(
              "detailRefresh"
            )}
          </button>
        </div>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-7 text-white sm:p-9">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/60">
            <Layers3
              size={16}
            />

            {t(
              "detailEyebrow"
            )}
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-4xl">
            {formatKlyxSplitMissionService(
              locale,
              mission.serviceSlug,
              mission.serviceName
            )}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            {t(
              "detailIntro"
            )}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black">
              {formatKlyxSplitMissionSlotCount(
                locale,
                mission.slotCount
              )}
            </span>

            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black">
              {formatKlyxSplitMissionProviderCount(
                locale,
                mission.providerCount
              )}
            </span>

            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black">
              {formatKlyxSplitMissionStatus(
                locale,
                mission.status
              )}
            </span>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">
            {t(
              "detailTimeline"
            )}
          </h2>

          <div className="mt-5 grid gap-4">
            {mission.slots.map(
              (
                slot
              ) => (
                <article
                  key={
                    slot.slotId
                  }
                  className="klyx-card p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                        {slot.providerAvatar ? (
                          <img
                            src={
                              slot.providerAvatar
                            }
                            alt={
                              slot.providerName
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound
                            size={22}
                          />
                        )}
                      </div>

                      <div>
                        <p className="font-black">
                          {slot.providerName}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatKlyxSplitMissionSlotPosition(
                            locale,
                            slot.position
                          )}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full border border-border px-3 py-1 text-xs font-black">
                      {formatKlyxSplitBookingStatus(
                        locale,
                        slot.bookingStatus
                      )}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <p className="flex items-center gap-2 text-xs font-black text-muted-foreground">
                        <CalendarDays
                          size={15}
                        />
                        {t(
                          "detailDate"
                        )}
                      </p>

                      <p className="mt-2 font-black">
                        {formatKlyxSplitMissionDetailDate(
                          locale,
                          slot.date
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <p className="flex items-center gap-2 text-xs font-black text-muted-foreground">
                        <Clock3
                          size={15}
                        />
                        {t(
                          "detailSchedule"
                        )}
                      </p>

                      <p className="mt-2 font-black">
                        {slot.startTime.slice(
                          0,
                          5
                        )}
                        {" – "}
                        {slot.endTime.slice(
                          0,
                          5
                        )}
                      </p>
                    </div>
                  </div>

                  {slot.bookingId && (
                    <Link
                      href={
                        "/bookings/" +
                        slot.bookingId
                      }
                      className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-500"
                    >
                      {t(
                        "detailOpenBooking"
                      )}

                      <ArrowRight
                        size={16}
                      />
                    </Link>
                  )}
                </article>
              )
            )}
          </div>
        </section>

        {/* KLYX_SPLIT_PROVIDER_ACCEPTANCE_WIRING_13_22 */}
        <SplitMissionAcceptance
          batchId={mission.batchId}
        />
        {/* KLYX_SPLIT_PRICE_CONFIRMATION_WIRING_13_23 */}
        <SplitMissionPriceConfirmation
          batchId={mission.batchId}
        />
        {/* KLYX_SPLIT_PAYMENT_CONTRACT_WIRING_13_24 */}
        <SplitMissionPaymentPlan
          batchId={mission.batchId}
        />
        {/* KLYX_SPLIT_STRIPE_READINESS_WIRING_13_25 */}
        <SplitMissionStripeReadiness
          batchId={mission.batchId}
        />
        {/* KLYX_SPLIT_PAYMENT_CONFIRMATION_WIRING_13_26 */}
        <SplitMissionPaymentConfirmation
          batchId={mission.batchId}
        />
        {/* KLYX_SPLIT_CHECKOUT_WIRING_13_27 */}
        <SplitMissionCheckout
          batchId={mission.batchId}
        />
        {/* KLYX_SPLIT_REFUND_STATUS_WIRING_13_28 */}
        <SplitMissionRefundStatus
          batchId={mission.batchId}
        />

        <section className="klyx-card mt-8 p-6">
          <div className="flex gap-3">
            <CheckCircle2
              className="shrink-0 text-emerald-500"
              size={21}
            />

            <div>
              <p className="font-black">
                {t(
                  "detailUnifiedTitle"
                )}
              </p>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(
                  "detailUnifiedDescription"
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm font-black text-muted-foreground">
            <UsersRound
              size={17}
            />

            {t(
              "detailNoPayment"
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
