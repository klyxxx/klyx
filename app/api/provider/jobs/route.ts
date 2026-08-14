import {
  NextResponse,
} from "next/server";

import {
  GET as getMarketRequests,
} from "@/app/api/market/requests/route";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_PROVIDER_MULTI_JOBS_API_12_93

type BaseRequest = {
  id: string;
  title: string;
  description: string;
  city: string;

  requested_date:
    | string
    | null;

  requested_time:
    | string
    | null;

  budget_max:
    | number
    | null;

  status:
    string;

  service:
    | {
        id?: string;
        name?: string | null;
        slug?: string;
      }
    | null;

  match?:
    | {
        score: number;
        reasons: string[];
        locationMatch?: boolean;
        availabilityMatch?: boolean;
        budgetMatch?: boolean | null;
      }
    | null;

  myOffer?:
    | {
        id: string;
        amount: number;
        message: string | null;
        status: string;
      }
    | null;
};

type RequestMeta = {
  id: string;

  request_mode:
    | "single"
    | "multi_slot";

  slot_count:
    number;

  budget_total:
    | number
    | null;

  prefer_single_provider:
    boolean;
};

type CandidateRow = {
  market_request_id:
    string;

  provider_profile_id:
    string;

  coverage_count:
    number;

  slot_count:
    number;

  full_coverage:
    boolean;
};

type SlotRow = {
  id: string;

  market_request_id:
    string;

  position:
    number;

  requested_date:
    string;

  start_time:
    | string
    | null;

  end_time:
    | string
    | null;

  budget_max:
    | number
    | null;

  duration_minutes:
    | number
    | null;
};

function numberOrNull(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

async function klyxProviderJobsBeforeLiveEligibility13_08(
  request: Request
) {
  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "provider"
    );

    /*
      On reutilise le backend historique.
      Cela conserve matching, offres existantes
      et toute evolution precedente du moteur.
    */
    const legacyResponse =
      await getMarketRequests(
        request
      );

    const legacyBody =
      (await legacyResponse.json()) as {
        role?: string;

        requests?:
          BaseRequest[];

        error?: string;
      };

    if (
      !legacyResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            legacyBody.error ??
            "Chargement des missions impossible.",
        },
        {
          status:
            legacyResponse.status,
        }
      );
    }

    const baseRequests =
      legacyBody.requests ??
      [];

    if (
      baseRequests.length ===
      0
    ) {
      return NextResponse.json({
        role:
          "provider",

        requests:
          [],

        multiSlotAware:
          true,

        fullCoverageOnly:
          true,
      });
    }

    const requestIds =
      baseRequests.map(
        (item) =>
          item.id
      );

    const {
      data:
        metaData,

      error:
        metaError,
    } = await supabaseAdmin
      .from(
        "market_service_requests"
      )
      .select(
        "id, request_mode, slot_count, budget_total, prefer_single_provider"
      )
      .in(
        "id",
        requestIds
      );

    if (metaError) {
      throw new Error(
        metaError.message
      );
    }

    const metas =
      (
        metaData ??
        []
      ) as unknown as
        RequestMeta[];

    const metaMap =
      new Map(
        metas.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

    const multiRequestIds =
      metas
        .filter(
          (item) =>
            item.request_mode ===
            "multi_slot"
        )
        .map(
          (item) =>
            item.id
        );

    let candidates:
      CandidateRow[] =
      [];

    if (
      multiRequestIds.length >
      0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "market_request_provider_candidates"
        )
        .select(
          "market_request_id, provider_profile_id, coverage_count, slot_count, full_coverage"
        )
        .eq(
          "provider_profile_id",
          profile.id
        )
        .in(
          "market_request_id",
          multiRequestIds
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      candidates =
        (
          data ??
          []
        ) as unknown as
          CandidateRow[];
    }

    const candidateMap =
      new Map(
        candidates.map(
          (candidate) => [
            candidate.market_request_id,
            candidate,
          ]
        )
      );

    /*
      Une mission multi-slot ne doit apparaitre
      dans les opportunites que si ce prestataire
      couvre TOUS les creneaux.
    */
    const visibleRequests =
      baseRequests.filter(
        (item) => {
          const meta =
            metaMap.get(
              item.id
            );

          if (
            !meta ||
            meta.request_mode !==
              "multi_slot"
          ) {
            return true;
          }

          const candidate =
            candidateMap.get(
              item.id
            );

          return Boolean(
            candidate &&
            candidate.full_coverage &&
            Number(
              candidate.coverage_count
            ) >=
              Number(
                candidate.slot_count
              )
          );
        }
      );

    const visibleMultiIds =
      visibleRequests
        .filter(
          (item) =>
            metaMap.get(
              item.id
            )?.request_mode ===
            "multi_slot"
        )
        .map(
          (item) =>
            item.id
        );

    let slots:
      SlotRow[] =
      [];

    if (
      visibleMultiIds.length >
      0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "market_service_request_slots"
        )
        .select(
          "id, market_request_id, position, requested_date, start_time, end_time, budget_max, duration_minutes"
        )
        .in(
          "market_request_id",
          visibleMultiIds
        )
        .order(
          "position",
          {
            ascending:
              true,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      slots =
        (
          data ??
          []
        ) as unknown as
          SlotRow[];
    }

    const slotsByRequest =
      new Map<
        string,
        SlotRow[]
      >();

    for (
      const slot
      of slots
    ) {
      const current =
        slotsByRequest.get(
          slot.market_request_id
        ) ??
        [];

      current.push(
        slot
      );

      slotsByRequest.set(
        slot.market_request_id,
        current
      );
    }

    const requests =
      visibleRequests.map(
        (item) => {
          const meta =
            metaMap.get(
              item.id
            );

          const requestMode =
            meta?.request_mode ??
            "single";

          const requestSlots =
            slotsByRequest.get(
              item.id
            ) ??
            [];

          const candidate =
            candidateMap.get(
              item.id
            );

          const knownMinutes =
            requestSlots.reduce(
              (
                total,
                slot
              ) =>
                total +
                Number(
                  slot.duration_minutes ??
                  0
                ),
              0
            );

          const slotBudgetSum =
            requestSlots.reduce(
              (
                total,
                slot
              ) =>
                total +
                Number(
                  slot.budget_max ??
                  0
                ),
              0
            );

          const budgetTotal =
            numberOrNull(
              meta?.budget_total
            ) ??
            (
              slotBudgetSum >
              0
                ? slotBudgetSum
                : null
            );

          return {
            ...item,

            requestMode,

            slotCount:
              requestMode ===
              "multi_slot"
                ? Number(
                    meta?.slot_count ??
                    requestSlots.length
                  )
                : 1,

            budgetTotal,

            preferSingleProvider:
              meta?.prefer_single_provider ??
              true,

            totalDurationMinutes:
              requestMode ===
                "multi_slot" &&
              requestSlots.length >
                0
                ? knownMinutes
                : null,

            slots:
              requestSlots.map(
                (slot) => ({
                  id:
                    slot.id,

                  position:
                    Number(
                      slot.position
                    ),

                  date:
                    slot.requested_date,

                  startTime:
                    slot.start_time,

                  endTime:
                    slot.end_time,

                  budgetMax:
                    numberOrNull(
                      slot.budget_max
                    ),

                  durationMinutes:
                    numberOrNull(
                      slot.duration_minutes
                    ),
                })
              ),

            coverage:
              requestMode ===
                "multi_slot" &&
              candidate
                ? {
                    count:
                      Number(
                        candidate.coverage_count
                      ),

                    total:
                      Number(
                        candidate.slot_count
                      ),

                    fullCoverage:
                      Boolean(
                        candidate.full_coverage
                      ),

                    label:
                      String(
                        candidate.coverage_count
                      ) +
                      "/" +
                      String(
                        candidate.slot_count
                      ),
                  }
                : null,
          };
        }
      );

    return NextResponse.json({
      role:
        "provider",

      requests,

      count:
        requests.length,

      multiSlotAware:
        true,

      fullCoverageOnly:
        true,

      automaticExecutionAllowed:
        false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les missions prestataire.";

    return NextResponse.json(
      {
        error:
          message,

        automaticExecutionAllowed:
          false,
      },
      {
        status:
          apiErrorStatus(
            message
          ),
      }
    );
  }
}

// KLYX_PROVIDER_JOBS_LIVE_ROUTE_13_08

export async function GET(
  request: Request
) {
  const legacyResponse =
    await klyxProviderJobsBeforeLiveEligibility13_08(
      request.clone()
    );

  if (
    !legacyResponse.ok
  ) {
    return legacyResponse;
  }

  let payload:
    unknown;

  try {
    payload =
      await legacyResponse
        .clone()
        .json();
  } catch {
    return legacyResponse;
  }

  try {
    const {
      revalidateProviderJobsPayload13_08,
    } =
      await import(
        "@/lib/provider-jobs-live-revalidation"
      );

    const nextPayload =
      await revalidateProviderJobsPayload13_08(
        request.clone(),
        payload
      );

    const headers =
      new Headers(
        legacyResponse.headers
      );

    headers.delete(
      "content-length"
    );

    headers.set(
      "content-type",
      "application/json; charset=utf-8"
    );

    headers.set(
      "cache-control",
      "no-store"
    );

    return Response.json(
      nextPayload,
      {
        status:
          legacyResponse.status,

        headers,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "LIVE_REVALIDATION_FAILED";

    /*
      Une mission multi non revalidable
      ne doit pas reapparaitre via
      un snapshot stale.
    */
    return Response.json(
      {
        code:
          "PROVIDER_JOBS_LIVE_REVALIDATION_UNAVAILABLE",

        error:
          "KLYX ne peut pas revalider les missions disponibles pour le moment.",

        detail:
          message,

        jobs:
          [],

        liveEligibilityChecked:
          false,

        automaticOffer:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          503,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }
}
