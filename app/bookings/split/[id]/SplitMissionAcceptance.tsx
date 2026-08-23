"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  useKlyxLocale,
} from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxSplitMissionAcceptance,
  type KlyxSplitMissionAcceptanceMessageKey,
} from "@/lib/klyx-split-mission-acceptance-i18n";
import {
  supabase,
} from "@/lib/supabase";

// KLYX_SPLIT_PROVIDER_ACCEPTANCE_UI_13_22
// KLYX_SPLIT_MISSION_ACCEPTANCE_I18N

type AggregateState =
  | "waiting"
  | "partially_accepted"
  | "all_accepted"
  | "rebuild_required"
  | "recovery_required";

type ProviderState =
  | "pending"
  | "accepted"
  | "rejected"
  | "recovery_required";

type ProviderAcceptance = {
  providerId:
    string;

  providerName:
    string;

  providerAvatar:
    string | null;

  state:
    ProviderState;

  slotCount:
    number;

  acceptedSlots:
    number;

  pendingSlots:
    number;

  rejectedSlots:
    number;

  missingSlots:
    number;

  bookingIds:
    string[];
};

type AcceptanceResult = {
  batchId?:
    string;

  marketRequestId?:
    string;

  aggregateState?:
    AggregateState;

  missionReadyForNextStep?:
    boolean;

  rebuildRecommended?:
    boolean;

  providerCount?:
    number;

  acceptedProviders?:
    number;

  pendingProviders?:
    number;

  rejectedProviders?:
    number;

  recoveryProviders?:
    number;

  providers?:
    ProviderAcceptance[];

  error?:
    string;
};

const AGGREGATE_LABEL_KEYS:
  Record<
    AggregateState,
    KlyxSplitMissionAcceptanceMessageKey
  > = {
  waiting:
    "aggregateWaiting",

  partially_accepted:
    "aggregatePartiallyAccepted",

  all_accepted:
    "aggregateAllAccepted",

  rebuild_required:
    "aggregateRebuildRequired",

  recovery_required:
    "aggregateRecoveryRequired",
};

const PROVIDER_LABEL_KEYS:
  Record<
    ProviderState,
    KlyxSplitMissionAcceptanceMessageKey
  > = {
  pending:
    "providerPending",

  accepted:
    "providerAccepted",

  rejected:
    "providerRejected",

  recovery_required:
    "providerRecoveryRequired",
};

async function accessToken(
  missingSessionMessage:
    string
): Promise<string> {
  const {
    data,
  } =
    await supabase.auth.getSession();

  const token =
    data.session
      ?.access_token;

  if (!token) {
    throw new Error(
      missingSessionMessage
    );
  }

  return token;
}

export default function SplitMissionAcceptance({
  batchId,
}: {
  batchId:
    string;
}) {
  const {
    locale,
  } =
    useKlyxLocale();

  const t = (
    key:
      KlyxSplitMissionAcceptanceMessageKey
  ) =>
    translateKlyxSplitMissionAcceptance(
      locale,
      key
    );

  const [
    result,
    setResult,
  ] =
    useState<
      AcceptanceResult |
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
    errorMessage,
    setErrorMessage,
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
          const token =
            await accessToken(
              translateKlyxSplitMissionAcceptance(
                locale,
                "sessionMissing"
              )
            );

          const response =
            await fetch(
              "/api/bookings/split-missions/" +
                encodeURIComponent(
                  batchId
                ) +
                "/acceptance",
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
            ) as AcceptanceResult;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ||
                translateKlyxSplitMissionAcceptance(
                  locale,
                  "verificationFallback"
                )
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
              : translateKlyxSplitMissionAcceptance(
                  locale,
                  "verificationFallback"
                )
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
        locale,
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
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle
          className="animate-spin text-violet-500"
          size={20}
        />

        <p className="text-sm font-bold text-muted-foreground">
          {t(
            "loadingResponses"
          )}
        </p>
      </section>
    );
  }

  if (
    errorMessage
  ) {
    return (
      <section className="mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6">
        <ShieldAlert
          className="text-rose-600"
          size={24}
        />

        <p className="mt-3 font-black">
          {t(
            "verificationImpossible"
          )}
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw
            size={16}
          />

          {t(
            "retry"
          )}
        </button>
      </section>
    );
  }

  const state =
    result?.aggregateState ??
    "waiting";

  const providers =
    result?.providers ??
    [];

  const danger =
    state ===
      "rebuild_required" ||
    state ===
      "recovery_required";

  return (
    <section
      className={
        danger
          ? "mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/5 p-6 sm:p-7"
          : "klyx-card mt-8 p-6 sm:p-7"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">
            KLYX 13.22
          </p>

          <h2 className="mt-2 text-xl font-black">
            {t(
              "title"
            )}
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              AGGREGATE_LABEL_KEYS[
                state
              ]
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw
            size={16}
          />

          {t(
            "refresh"
          )}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="flex items-center gap-2 text-xs font-black text-muted-foreground">
            <UsersRound
              size={15}
            />
            {t(
              "providers"
            )}
          </p>

          <p className="mt-2 text-2xl font-black">
            {result?.providerCount ??
              0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-black text-muted-foreground">
            {t(
              "acceptedProviders"
            )}
          </p>

          <p className="mt-2 text-2xl font-black text-emerald-600">
            {result?.acceptedProviders ??
              0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-black text-muted-foreground">
            {t(
              "pendingProviders"
            )}
          </p>

          <p className="mt-2 text-2xl font-black">
            {result?.pendingProviders ??
              0}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {providers.map(
          (
            provider
          ) => (
            <article
              key={
                provider.providerId
              }
              className="rounded-2xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                    {provider.providerAvatar ? (
                      <img
                        src={
                          provider.providerAvatar
                        }
                        alt={
                          provider.providerName
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound
                        size={20}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-black">
                      {provider.providerName}
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3
                        size={12}
                      />

                      {provider.slotCount}{" "}
                      {t(
                        "slots"
                      )}
                    </p>
                  </div>
                </div>

                <span
                  className={
                    provider.state ===
                    "accepted"
                      ? "rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600"
                      : provider.state ===
                          "rejected" ||
                        provider.state ===
                          "recovery_required"
                        ? "rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-600"
                        : "rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600"
                  }
                >
                  {t(
                    PROVIDER_LABEL_KEYS[
                      provider.state
                    ]
                  )}
                </span>
              </div>
            </article>
          )
        )}
      </div>

      {state ===
        "all_accepted" && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <CheckCircle2
            className="shrink-0 text-emerald-600"
            size={21}
          />

          <div>
            <p className="font-black">
              {t(
                "allAcceptedTitle"
              )}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "allAcceptedDescription"
              )}
            </p>
          </div>
        </div>
      )}

      {state ===
        "partially_accepted" && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <Clock3
            className="shrink-0 text-amber-600"
            size={21}
          />

          <div>
            <p className="font-black">
              {t(
                "partiallyAcceptedTitle"
              )}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "partiallyAcceptedDescription"
              )}
            </p>
          </div>
        </div>
      )}

      {state ===
        "rebuild_required" && (
        <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <div className="flex gap-3">
            <AlertTriangle
              className="shrink-0 text-rose-600"
              size={21}
            />

            <div>
              <p className="font-black">
                {t(
                  "rebuildTitle"
                )}
              </p>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t(
                  "rebuildDescription"
                )}
              </p>
            </div>
          </div>

          {result?.marketRequestId && (
            <Link
              href={
                "/assistant/market/" +
                result.marketRequestId +
                "/split-plan"
              }
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"
            >
              {t(
                "reviewPlan"
              )}

              <ArrowRight
                size={16}
              />
            </Link>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {t(
              "rebuildConfirmationDescription"
            )}
          </p>
        </div>
      )}

      {state ===
        "recovery_required" && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <ShieldAlert
            className="shrink-0 text-rose-600"
            size={21}
          />

          <div>
            <p className="font-black">
              {t(
                "recoveryTitle"
              )}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "recoveryDescription"
              )}
            </p>
          </div>
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        {t(
          "automationSummary"
        )}
      </p>
    </section>
  );
}
