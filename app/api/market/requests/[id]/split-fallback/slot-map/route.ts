import {
  NextResponse,
} from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_MULTI_PROVIDER_EXACT_SLOT_MAP_13_16
// SLOT TABLE RESOLVED FROM 12.83: market_service_request_slots

type JsonRecord =
  Record<
    string,
    unknown
  >;

type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};

type Slot = {
  id:
    string;

  position:
    number;

  date:
    string;

  startTime:
    string;

  endTime:
    string;

  budgetMax:
    number | null;
};

type CoverageResult = {
  ok:
    boolean;

  fullCoverage:
    boolean;

  coverageCount:
    number;

  slotCount:
    number;

  code:
    string;
};

type ProviderCoverage = {
  providerId:
    string;

  userServiceId:
    string;

  score:
    number;

  verified:
    boolean;

  rpcCode:
    string;

  slotIds:
    string[];

  coverageCount:
    number;

  slotCount:
    number;
};

function asRecord(
  value:
    unknown
): JsonRecord | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as
    JsonRecord;
}

function text(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function integer(
  value:
    unknown
): number {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return Math.trunc(
    parsed
  );
}

function numberValue(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function booleanValue(
  value:
    unknown
): boolean {
  return (
    value === true ||
    value === "true"
  );
}

function firstText(
  row:
    JsonRecord,

  keys:
    string[]
): string {
  for (
    const key
    of keys
  ) {
    const value =
      text(
        row[key]
      );

    if (value) {
      return value;
    }
  }

  return "";
}

function firstInteger(
  row:
    JsonRecord,

  keys:
    string[]
): number {
  for (
    const key
    of keys
  ) {
    const value =
      integer(
        row[key]
      );

    if (
      value !==
      0
    ) {
      return value;
    }
  }

  return 0;
}

function firstNumber(
  row:
    JsonRecord,

  keys:
    string[]
): number | null {
  for (
    const key
    of keys
  ) {
    const value =
      numberValue(
        row[key]
      );

    if (
      value !==
      null
    ) {
      return value;
    }
  }

  return null;
}

function normalizeTime(
  value:
    unknown
): string {
  const raw =
    text(
      value
    );

  if (
    /^\d{2}:\d{2}/.test(
      raw
    )
  ) {
    return raw.slice(
      0,
      5
    );
  }

  return "";
}

function timeMinutes(
  value:
    string
): number | null {
  if (
    !/^\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const [
    hours,
    minutes,
  ] =
    value
      .split(":")
      .map(
        Number
      );

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    hours *
      60 +
    minutes
  );
}

function slotDate(
  row:
    JsonRecord
): string {
  const value =
    firstText(
      row,
      [
        "requested_date",
        "slot_date",
        "date",
        "booking_date",
        "service_date",
      ]
    );

  return /^\d{4}-\d{2}-\d{2}/.test(
    value
  )
    ? value.slice(
        0,
        10
      )
    : "";
}

function slotStart(
  row:
    JsonRecord
): string {
  return normalizeTime(
    firstText(
      row,
      [
        "start_time",
        "requested_start_time",
        "slot_start_time",
        "starts_at",
      ]
    )
  );
}

function slotEnd(
  row:
    JsonRecord
): string {
  return normalizeTime(
    firstText(
      row,
      [
        "end_time",
        "requested_end_time",
        "slot_end_time",
        "ends_at",
      ]
    )
  );
}

function slotPosition(
  row:
    JsonRecord,

  fallback:
    number
): number {
  const value =
    firstInteger(
      row,
      [
        "slot_position",
        "slot_index",
        "position",
        "sort_order",
        "sequence",
      ]
    );

  return value > 0
    ? value
    : fallback;
}

function slotBudget(
  row:
    JsonRecord
): number | null {
  return firstNumber(
    row,
    [
      "budget_max",
      "budget_amount",
      "budget",
      "max_budget",
      "amount_max",
    ]
  );
}

function requestOwner(
  row:
    JsonRecord
): string {
  return firstText(
    row,
    [
      "client_profile_id",
      "client_id",
      "profile_id",
      "owner_profile_id",
    ]
  );
}

function candidateProviderId(
  row:
    JsonRecord
): string {
  return firstText(
    row,
    [
      "provider_profile_id",
      "provider_id",
    ]
  );
}

function candidateScore(
  row:
    JsonRecord
): number {
  const value =
    firstNumber(
      row,
      [
        "ranking_score",
        "match_score",
        "score",
        "klyx_score",
      ]
    );

  return value ??
    0;
}

function bookingProviderId(
  row:
    JsonRecord
): string {
  return firstText(
    row,
    [
      "provider_profile_id",
      "provider_id",
      "babysitter_id",
    ]
  );
}

function bookingDate(
  row:
    JsonRecord
): string {
  const value =
    firstText(
      row,
      [
        "booking_date",
        "service_date",
        "requested_date",
        "date",
      ]
    );

  return value.slice(
    0,
    10
  );
}

function bookingStart(
  row:
    JsonRecord
): string {
  return normalizeTime(
    firstText(
      row,
      [
        "start_time",
        "service_start_time",
      ]
    )
  );
}

function bookingEnd(
  row:
    JsonRecord
): string {
  return normalizeTime(
    firstText(
      row,
      [
        "end_time",
        "service_end_time",
      ]
    )
  );
}

function bookingBlocks(
  row:
    JsonRecord
): boolean {
  const status =
    firstText(
      row,
      [
        "status",
      ]
    ).toLowerCase();

  const serviceStatus =
    firstText(
      row,
      [
        "service_status",
      ]
    ).toLowerCase();

  const terminal =
    new Set([
      "cancelled",
      "canceled",
      "rejected",
      "expired",
      "completed",
    ]);

  if (
    terminal.has(
      status
    )
  ) {
    return false;
  }

  if (
    terminal.has(
      serviceStatus
    )
  ) {
    return false;
  }

  return true;
}

function overlaps(
  firstStart:
    string,

  firstEnd:
    string,

  secondStart:
    string,

  secondEnd:
    string
): boolean {
  const aStart =
    timeMinutes(
      firstStart
    );

  const aEnd =
    timeMinutes(
      firstEnd
    );

  const bStart =
    timeMinutes(
      secondStart
    );

  const bEnd =
    timeMinutes(
      secondEnd
    );

  if (
    aStart === null ||
    aEnd === null ||
    bStart === null ||
    bEnd === null
  ) {
    return true;
  }

  return (
    aStart <
      bEnd &&
    bStart <
      aEnd
  );
}

function parseCoverage(
  value:
    unknown
): CoverageResult {
  const first =
    Array.isArray(
      value
    )
      ? value[0]
      : value;

  const row =
    asRecord(
      first
    );

  if (!row) {
    return {
      ok:
        false,

      fullCoverage:
        false,

      coverageCount:
        0,

      slotCount:
        0,

      code:
        "INVALID_RPC_RESPONSE",
    };
  }

  return {
    ok:
      booleanValue(
        row.ok
      ),

    fullCoverage:
      booleanValue(
        row.fullCoverage
      ) ||
      booleanValue(
        row.full_coverage
      ),

    coverageCount:
      Math.max(
        firstInteger(
          row,
          [
            "coverageCount",
            "coverage_count",
          ]
        ),
        0
      ),

    slotCount:
      Math.max(
        firstInteger(
          row,
          [
            "slotCount",
            "slot_count",
          ]
        ),
        0
      ),

    code:
      firstText(
        row,
        [
          "code",
        ]
      ) ||
      "UNKNOWN",
  };
}

function availabilityCovers(
  slot:
    Slot,

  availability:
    JsonRecord[]
): boolean {
  const requestedStart =
    timeMinutes(
      slot.startTime
    );

  const requestedEnd =
    timeMinutes(
      slot.endTime
    );

  if (
    requestedStart ===
      null ||
    requestedEnd ===
      null ||
    requestedEnd <=
      requestedStart
  ) {
    return false;
  }

  const day =
    new Date(
      slot.date +
      "T12:00:00Z"
    )
      .getUTCDay();

  return availability.some(
    (
      row
    ) => {
      if (
        integer(
          row.day_of_week
        ) !==
        day
      ) {
        return false;
      }

      const start =
        timeMinutes(
          normalizeTime(
            row.start_time
          )
        );

      const end =
        timeMinutes(
          normalizeTime(
            row.end_time
          )
        );

      if (
        start === null ||
        end === null
      ) {
        return false;
      }

      return (
        requestedStart >=
          start &&
        requestedEnd <=
          end
      );
    }
  );
}

function bookingConflict(
  providerId:
    string,

  slot:
    Slot,

  bookings:
    JsonRecord[]
): boolean {
  return bookings.some(
    (
      booking
    ) => {
      if (
        !bookingBlocks(
          booking
        )
      ) {
        return false;
      }

      if (
        bookingProviderId(
          booking
        ) !==
        providerId
      ) {
        return false;
      }

      if (
        bookingDate(
          booking
        ) !==
        slot.date
      ) {
        return false;
      }

      return overlaps(
        slot.startTime,
        slot.endTime,
        bookingStart(
          booking
        ),
        bookingEnd(
          booking
        )
      );
    }
  );
}

function providerName(
  row:
    JsonRecord | undefined,

  providerId:
    string
): string {
  if (!row) {
    return (
      "Prestataire " +
      providerId.slice(
        0,
        8
      )
    );
  }

  const name =
    [
      text(
        row.first_name
      ),
      text(
        row.last_name
      ),
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
      .trim();

  return name ||
    (
      "Prestataire " +
      providerId.slice(
        0,
        8
      )
    );
}

export async function GET(
  request:
    Request,

  context:
    RouteContext
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
      "client"
    );

    const {
      id:
        requestId,
    } =
      await context.params;

    if (
      !requestId
    ) {
      return NextResponse.json(
        {
          error:
            "Demande KLYX invalide.",
        },
        {
          status:
            400,
        }
      );
    }

    const {
      data:
        requestData,

      error:
        requestError,
    } =
      await supabaseAdmin
        .from(
          "market_service_requests"
        )
        .select(
          "*"
        )
        .eq(
          "id",
          requestId
        )
        .maybeSingle();

    if (
      requestError
    ) {
      throw new Error(
        "SPLIT_MAP_REQUEST_LOAD_FAILED:" +
        requestError.message
      );
    }

    const marketRequest =
      asRecord(
        requestData
      );

    if (
      !marketRequest
    ) {
      return NextResponse.json(
        {
          error:
            "Demande KLYX introuvable.",
        },
        {
          status:
            404,
        }
      );
    }

    const ownerId =
      requestOwner(
        marketRequest
      );

    if (
      ownerId &&
      ownerId !==
        profile.id
    ) {
      return NextResponse.json(
        {
          error:
            "Acces refuse.",
        },
        {
          status:
            403,
        }
      );
    }

    const serviceId =
      firstText(
        marketRequest,
        [
          "service_id",
        ]
      );

    if (
      !serviceId
    ) {
      return NextResponse.json(
        {
          error:
            "Service KLYX introuvable pour cette demande.",

          code:
            "SPLIT_MAP_SERVICE_REQUIRED",
        },
        {
          status:
            409,
        }
      );
    }

    const {
      data:
        slotData,

      error:
        slotError,
    } =
      await supabaseAdmin
        .from(
          "market_service_request_slots"
        )
        .select(
          "*"
        )
        .eq(
          "market_request_id",
          requestId
        );

    if (
      slotError
    ) {
      throw new Error(
        "SPLIT_MAP_SLOTS_LOAD_FAILED:" +
        slotError.message
      );
    }

    const rawSlots =
      (
        slotData ??
        []
      )
        .map(
          asRecord
        )
        .filter(
          (
            row
          ): row is JsonRecord =>
            row !==
            null
        );

    const slots =
      rawSlots
        .map(
          (
            row,
            index
          ): Slot => ({
            id:
              firstText(
                row,
                [
                  "id",
                ]
              ) ||
              (
                requestId +
                "-slot-" +
                String(
                  index +
                  1
                )
              ),

            position:
              slotPosition(
                row,
                index +
                  1
              ),

            date:
              slotDate(
                row
              ),

            startTime:
              slotStart(
                row
              ),

            endTime:
              slotEnd(
                row
              ),

            budgetMax:
              slotBudget(
                row
              ),
          })
        )
        .sort(
          (
            first,
            second
          ) =>
            first.position -
              second.position ||
            first.date.localeCompare(
              second.date
            ) ||
            first.startTime.localeCompare(
              second.startTime
            )
        );

    if (
      slots.length <
      2
    ) {
      return NextResponse.json(
        {
          requestId,

          slotCount:
            slots.length,

          splitPlanPossible:
            false,

          reason:
            "MULTI_SLOT_REQUIRED",

          explicitConfirmationRequired:
            true,

          automaticProviderSelection:
            false,

          automaticBooking:
            false,

          automaticPayment:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    const invalidSlots =
      slots.filter(
        (
          slot
        ) => {
          const start =
            timeMinutes(
              slot.startTime
            );

          const end =
            timeMinutes(
              slot.endTime
            );

          return (
            !slot.date ||
            start ===
              null ||
            end ===
              null ||
            end <=
              start
          );
        }
      );

    if (
      invalidSlots.length >
      0
    ) {
      return NextResponse.json(
        {
          requestId,

          slotCount:
            slots.length,

          splitPlanPossible:
            false,

          reason:
            "INVALID_OR_OVERNIGHT_SLOT",

          invalidSlotIds:
            invalidSlots.map(
              (
                slot
              ) =>
                slot.id
            ),

          explicitConfirmationRequired:
            true,

          automaticProviderSelection:
            false,

          automaticBooking:
            false,

          automaticPayment:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    const {
      data:
        candidateData,

      error:
        candidateError,
    } =
      await supabaseAdmin
        .from(
          "market_request_provider_candidates"
        )
        .select(
          "*"
        )
        .eq(
          "market_request_id",
          requestId
        );

    if (
      candidateError
    ) {
      throw new Error(
        "SPLIT_MAP_CANDIDATES_LOAD_FAILED:" +
        candidateError.message
      );
    }

    const candidates =
      (
        candidateData ??
        []
      )
        .map(
          asRecord
        )
        .filter(
          (
            row
          ): row is JsonRecord =>
            row !==
            null
        );

    const providerIds =
      Array.from(
        new Set(
          candidates
            .map(
              candidateProviderId
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      providerIds.length ===
      0
    ) {
      return NextResponse.json({
        requestId,

        slots,

        providerMappings:
          [],

        splitPlanPossible:
          false,

        reason:
          "NO_PROVIDER_CANDIDATES",

        uncoveredSlotIds:
          slots.map(
            (
              slot
            ) =>
              slot.id
          ),

        explicitConfirmationRequired:
          true,

        automaticProviderSelection:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      });
    }

    const {
      data:
        userServiceData,

      error:
        userServiceError,
    } =
      await supabaseAdmin
        .from(
          "user_services"
        )
        .select(
          "id, user_id, service_id, active, provider_enabled"
        )
        .in(
          "user_id",
          providerIds
        )
        .eq(
          "service_id",
          serviceId
        )
        .eq(
          "active",
          true
        )
        .eq(
          "provider_enabled",
          true
        );

    if (
      userServiceError
    ) {
      throw new Error(
        "SPLIT_MAP_USER_SERVICES_FAILED:" +
        userServiceError.message
      );
    }

    const userServices =
      (
        userServiceData ??
        []
      ) as unknown as
        JsonRecord[];

    const userServiceByProvider =
      new Map<
        string,
        string
      >();

    for (
      const row
      of userServices
    ) {
      const providerId =
        text(
          row.user_id
        );

      const userServiceId =
        text(
          row.id
        );

      if (
        providerId &&
        userServiceId
      ) {
        userServiceByProvider.set(
          providerId,
          userServiceId
        );
      }
    }

    const userServiceIds =
      Array.from(
        userServiceByProvider.values()
      );

    const {
      data:
        availabilityData,

      error:
        availabilityError,
    } =
      userServiceIds.length >
        0
        ? await supabaseAdmin
            .from(
              "availability_slots"
            )
            .select(
              "user_service_id, day_of_week, start_time, end_time, is_active"
            )
            .in(
              "user_service_id",
              userServiceIds
            )
            .eq(
              "is_active",
              true
            )
        : {
            data:
              [],

            error:
              null,
          };

    if (
      availabilityError
    ) {
      throw new Error(
        "SPLIT_MAP_AVAILABILITY_FAILED:" +
        availabilityError.message
      );
    }

    const availability =
      (
        availabilityData ??
        []
      ) as unknown as
        JsonRecord[];

    const availabilityByUserService =
      new Map<
        string,
        JsonRecord[]
      >();

    for (
      const row
      of availability
    ) {
      const id =
        text(
          row.user_service_id
        );

      if (!id) {
        continue;
      }

      const current =
        availabilityByUserService.get(
          id
        ) ??
        [];

      current.push(
        row
      );

      availabilityByUserService.set(
        id,
        current
      );
    }

    const dates =
      Array.from(
        new Set(
          slots.map(
            (
              slot
            ) =>
              slot.date
          )
        )
      );

    const {
      data:
        bookingData,

      error:
        bookingError,
    } =
      dates.length >
        0
        ? await supabaseAdmin
            .from(
              "bookings"
            )
            .select(
              "*"
            )
            .in(
              "booking_date",
              dates
            )
            .limit(
              1000
            )
        : {
            data:
              [],

            error:
              null,
          };

    if (
      bookingError
    ) {
      throw new Error(
        "SPLIT_MAP_BOOKINGS_FAILED:" +
        bookingError.message
      );
    }

    const bookings =
      (
        bookingData ??
        []
      ) as unknown as
        JsonRecord[];

    const candidateByProvider =
      new Map<
        string,
        JsonRecord
      >();

    for (
      const candidate
      of candidates
    ) {
      const providerId =
        candidateProviderId(
          candidate
        );

      if (
        providerId &&
        !candidateByProvider.has(
          providerId
        )
      ) {
        candidateByProvider.set(
          providerId,
          candidate
        );
      }
    }

    const providerMappings:
      ProviderCoverage[] =
      [];

    for (
      const providerId
      of providerIds
    ) {
      const userServiceId =
        userServiceByProvider.get(
          providerId
        );

      if (
        !userServiceId
      ) {
        continue;
      }

      const {
        data:
          liveData,

        error:
          liveError,
      } =
        await supabaseAdmin.rpc(
          "klyx_group_live_coverage_check",
          {
            p_request_id:
              requestId,

            p_provider_profile_id:
              providerId,

            p_user_service_id:
              userServiceId,
          }
        );

      if (
        liveError
      ) {
        providerMappings.push({
          providerId,

          userServiceId,

          score:
            candidateScore(
              candidateByProvider.get(
                providerId
              ) ??
              {}
            ),

          verified:
            false,

          rpcCode:
            "RPC_ERROR",

          slotIds:
            [],

          coverageCount:
            0,

          slotCount:
            slots.length,
        });

        continue;
      }

      const live =
        parseCoverage(
          liveData
        );

      const providerAvailability =
        availabilityByUserService.get(
          userServiceId
        ) ??
        [];

      const slotIds =
        slots
          .filter(
            (
              slot
            ) =>
              availabilityCovers(
                slot,
                providerAvailability
              ) &&
              !bookingConflict(
                providerId,
                slot,
                bookings
              )
          )
          .map(
            (
              slot
            ) =>
              slot.id
          );

      /*
        Preuve croisee 13.16 :

        le mapping TS par slot n'est considere
        fiable QUE SI son nombre de slots
        correspond exactement au RPC live 12.96.

        Une divergence => fail closed.
      */
      const verified =
        live.ok &&
        live.slotCount ===
          slots.length &&
        live.coverageCount ===
          slotIds.length;

      providerMappings.push({
        providerId,

        userServiceId,

        score:
          candidateScore(
            candidateByProvider.get(
              providerId
            ) ??
            {}
          ),

        verified,

        rpcCode:
          live.code,

        slotIds:
          verified
            ? slotIds
            : [],

        coverageCount:
          verified
            ? slotIds.length
            : 0,

        slotCount:
          slots.length,
      });
    }

    const verifiedMappings =
      providerMappings
        .filter(
          (
            mapping
          ) =>
            mapping.verified &&
            mapping.coverageCount >
              0
        )
        .sort(
          (
            first,
            second
          ) =>
            second.coverageCount -
              first.coverageCount ||
            second.score -
              first.score
        );

    const fullCoverageProvider =
      verifiedMappings.find(
        (
          mapping
        ) =>
          mapping.coverageCount ===
          slots.length
      );

    const {
      data:
        profileData,

      error:
        profileError,
    } =
      providerIds.length >
        0
        ? await supabaseAdmin
            .from(
              "profiles"
            )
            .select(
              "id, first_name, last_name"
            )
            .in(
              "id",
              providerIds
            )
        : {
            data:
              [],

            error:
              null,
          };

    if (
      profileError
    ) {
      throw new Error(
        "SPLIT_MAP_PROFILES_FAILED:" +
        profileError.message
      );
    }

    const profileMap =
      new Map<
        string,
        JsonRecord
      >();

    for (
      const row
      of (
        profileData ??
        []
      ) as unknown as
        JsonRecord[]
    ) {
      const id =
        text(
          row.id
        );

      if (id) {
        profileMap.set(
          id,
          row
        );
      }
    }

    if (
      fullCoverageProvider
    ) {
      return NextResponse.json({
        requestId,

        slotCount:
          slots.length,

        slots,

        singleProviderFullCoverage:
          true,

        splitFallbackRequired:
          false,

        splitPlanPossible:
          false,

        reason:
          "SINGLE_PROVIDER_FULL_COVERAGE_AVAILABLE",

        preferredProvider: {
          providerId:
            fullCoverageProvider.providerId,

          providerName:
            providerName(
              profileMap.get(
                fullCoverageProvider.providerId
              ),
              fullCoverageProvider.providerId
            ),

          userServiceId:
            fullCoverageProvider.userServiceId,

          slotIds:
            fullCoverageProvider.slotIds,

          coverageCount:
            fullCoverageProvider.coverageCount,

          slotCount:
            fullCoverageProvider.slotCount,

          score:
            fullCoverageProvider.score,
        },

        providerMappings,

        explicitConfirmationRequired:
          true,

        automaticProviderSelection:
          false,

        automaticMarketAction:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      });
    }

    /*
      --------------------------------------------------------
      GREEDY VERIFIED SET COVER
      --------------------------------------------------------

      Chaque choix est base uniquement sur
      les slots LIVE ET VERIFIES.

      Ce plan est une recommandation.
      Il ne selectionne aucun prestataire.
    */

    const uncovered =
      new Set(
        slots.map(
          (
            slot
          ) =>
            slot.id
        )
      );

    const remaining =
      [
        ...verifiedMappings,
      ];

    const selected:
      Array<{
        mapping:
          ProviderCoverage;

        assignedSlotIds:
          string[];
      }> =
      [];

    while (
      uncovered.size >
        0 &&
      remaining.length >
        0
    ) {
      let bestIndex =
        -1;

      let bestGain =
        0;

      let bestScore =
        -Infinity;

      for (
        let index =
          0;
        index <
          remaining.length;
        index +=
          1
      ) {
        const mapping =
          remaining[index];

        const gain =
          mapping.slotIds.filter(
            (
              slotId
            ) =>
              uncovered.has(
                slotId
              )
          ).length;

        if (
          gain >
            bestGain ||
          (
            gain ===
              bestGain &&
            gain >
              0 &&
            mapping.score >
              bestScore
          )
        ) {
          bestIndex =
            index;

          bestGain =
            gain;

          bestScore =
            mapping.score;
        }
      }

      if (
        bestIndex <
          0 ||
        bestGain ===
          0
      ) {
        break;
      }

      const [
        mapping,
      ] =
        remaining.splice(
          bestIndex,
          1
        );

      const assignedSlotIds =
        mapping.slotIds.filter(
          (
            slotId
          ) =>
            uncovered.has(
              slotId
            )
        );

      for (
        const slotId
        of assignedSlotIds
      ) {
        uncovered.delete(
          slotId
        );
      }

      selected.push({
        mapping,

        assignedSlotIds,
      });
    }

    const splitPlanPossible =
      uncovered.size ===
        0 &&
      selected.length >=
        2;

    const assignments =
      selected.map(
        (
          item,
          index
        ) => ({
          rank:
            index +
            1,

          providerId:
            item.mapping.providerId,

          providerName:
            providerName(
              profileMap.get(
                item.mapping.providerId
              ),
              item.mapping.providerId
            ),

          userServiceId:
            item.mapping.userServiceId,

          score:
            item.mapping.score,

          assignedSlotIds:
            item.assignedSlotIds,

          assignedSlots:
            slots.filter(
              (
                slot
              ) =>
                item.assignedSlotIds.includes(
                  slot.id
                )
            ),
        })
      );

    return NextResponse.json({
      requestId,

      slotCount:
        slots.length,

      slots,

      singleProviderFullCoverage:
        false,

      splitFallbackRequired:
        true,

      splitPlanPossible,

      splitPlanStatus:
        splitPlanPossible
          ? "verified_ready_for_client_review"
          : "incomplete_live_coverage",

      reason:
        splitPlanPossible
          ? "EXACT_MULTI_PROVIDER_PLAN_AVAILABLE"
          : "EXACT_MULTI_PROVIDER_PLAN_INCOMPLETE",

      assignments:
        splitPlanPossible
          ? assignments
          : [],

      uncoveredSlotIds:
        Array.from(
          uncovered
        ),

      verifiedProviderCount:
        verifiedMappings.length,

      unverifiedProviderCount:
        providerMappings.filter(
          (
            mapping
          ) =>
            !mapping.verified
        ).length,

      providerMappings,

      proof: {
        source:
          "availability_slots_plus_bookings_cross_checked_with_12_96_rpc",

        slotMappingVerified:
          splitPlanPossible,

        liveValidation:
          true,

        bookingConflictCheck:
          true,

        rpcCrossCheck:
          true,
      },

      explicitConfirmationRequired:
        true,

      automaticProviderSelection:
        false,

      automaticMarketAction:
        false,

      automaticBooking:
        false,

      automaticPayment:
        false,
    });
  }
  catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "MULTI_PROVIDER_EXACT_SLOT_MAP_FAILED";

    return NextResponse.json(
      {
        error:
          "Impossible de calculer le plan multi-prestataires.",

        detail:
          message,

        splitPlanPossible:
          false,

        automaticProviderSelection:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          500,
      }
    );
  }
}