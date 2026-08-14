import "server-only";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_PROVIDER_JOBS_LIVE_ELIGIBILITY_13_08

type JsonRecord = Record<
  string,
  unknown
>;

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ServiceRow = {
  id: string;
  slug: string;
};

type Extraction = {
  rootArray: boolean;
  key: string | null;
  items: JsonRecord[];
};

function asRecord(
  value: unknown
): JsonRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonRecord;
}

function asText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function asPositiveInteger(
  value: unknown
): number {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return 0;
  }

  return parsed;
}

function asBoolean(
  value: unknown
): boolean {
  return (
    value === true ||
    value === "true"
  );
}

function extractPayload(
  payload: unknown
): Extraction | null {
  if (
    Array.isArray(payload)
  ) {
    return {
      rootArray: true,
      key: null,
      items: payload
        .map(asRecord)
        .filter(
          (
            item
          ): item is JsonRecord =>
            item !== null
        ),
    };
  }

  const body =
    asRecord(payload);

  if (!body) {
    return null;
  }

  for (
    const key
    of [
      "jobs",
      "requests",
      "items",
      "opportunities",
      "missions",
    ]
  ) {
    const value =
      body[key];

    if (
      Array.isArray(value)
    ) {
      return {
        rootArray: false,
        key,
        items: value
          .map(asRecord)
          .filter(
            (
              item
            ): item is JsonRecord =>
              item !== null
          ),
      };
    }
  }

  return null;
}

function getRequestId(
  item: JsonRecord
): string {
  return (
    asText(item.id) ||
    asText(item.requestId) ||
    asText(item.request_id)
  );
}

function serviceSlug(
  source: JsonRecord
): string {
  const relation =
    asRecord(
      source.service
    );

  return (
    asText(source.serviceSlug) ||
    asText(source.service_slug) ||
    asText(relation?.slug)
  ).toLowerCase();
}

function serviceId(
  source: JsonRecord
): string {
  return (
    asText(source.serviceId) ||
    asText(source.service_id)
  );
}

function isMultiSlot(
  requestRow: JsonRecord,
  item: JsonRecord
): boolean {
  const mode =
    (
      asText(
        requestRow.request_mode
      ) ||
      asText(
        item.requestMode
      ) ||
      asText(
        item.request_mode
      )
    ).toLowerCase();

  const slotCount =
    asPositiveInteger(
      requestRow.slot_count
    ) ||
    asPositiveInteger(
      item.slotCount
    ) ||
    asPositiveInteger(
      item.slot_count
    );

  return (
    mode === "multi_slot" ||
    slotCount >= 2
  );
}

function parseCoverage(
  value: unknown
) {
  const row =
    asRecord(value);

  if (!row) {
    return {
      ok: false,
      fullCoverage: false,
      coverageCount: 0,
      slotCount: 0,
      code: "INVALID_RESPONSE",
    };
  }

  return {
    ok:
      asBoolean(row.ok),

    fullCoverage:
      asBoolean(
        row.fullCoverage
      ) ||
      asBoolean(
        row.full_coverage
      ),

    coverageCount:
      asPositiveInteger(
        row.coverageCount
      ) ||
      asPositiveInteger(
        row.coverage_count
      ),

    slotCount:
      asPositiveInteger(
        row.slotCount
      ) ||
      asPositiveInteger(
        row.slot_count
      ),

    code:
      asText(row.code) ||
      "UNKNOWN",
  };
}

async function resyncCandidate(
  params: {
    requestId: string;
    providerProfileId: string;
    coverageCount: number;
    slotCount: number;
    fullCoverage: boolean;
  }
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "market_request_provider_candidates"
      )
      .update({
        coverage_count:
          params.coverageCount,

        slot_count:
          params.slotCount,

        full_coverage:
          params.fullCoverage,
      })
      .eq(
        "market_request_id",
        params.requestId
      )
      .eq(
        "provider_profile_id",
        params.providerProfileId
      );

  return !error;
}

export async function revalidateProviderJobsPayload13_08(
  request: Request,
  payload: unknown
): Promise<unknown> {
  const extraction =
    extractPayload(payload);

  if (!extraction) {
    return payload;
  }

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

  const requestIds =
    Array.from(
      new Set(
        extraction.items
          .map(getRequestId)
          .filter(Boolean)
      )
    );

  if (
    requestIds.length === 0
  ) {
    return payload;
  }

  const {
    data: requestData,
    error: requestError,
  } =
    await supabaseAdmin
      .from(
        "market_service_requests"
      )
      .select("*")
      .in(
        "id",
        requestIds
      );

  if (requestError) {
    throw new Error(
      "PROVIDER_JOBS_REQUEST_LOAD_FAILED:" +
        requestError.message
    );
  }

  const requests =
    (
      requestData ??
      []
    ) as unknown as
      JsonRecord[];

  const requestById =
    new Map<
      string,
      JsonRecord
    >();

  for (
    const row
    of requests
  ) {
    const id =
      asText(row.id);

    if (id) {
      requestById.set(
        id,
        row
      );
    }
  }

  const {
    data: userServiceData,
    error: userServiceError,
  } =
    await supabaseAdmin
      .from(
        "user_services"
      )
      .select(
        "id, service_id"
      )
      .eq(
        "user_id",
        profile.id
      )
      .eq(
        "active",
        true
      )
      .eq(
        "provider_enabled",
        true
      );

  if (userServiceError) {
    throw new Error(
      "PROVIDER_JOBS_SERVICES_FAILED:" +
        userServiceError.message
    );
  }

  const userServices =
    (
      userServiceData ??
      []
    ) as unknown as
      UserServiceRow[];

  const serviceIds =
    Array.from(
      new Set(
        userServices.map(
          (item) =>
            item.service_id
        )
      )
    );

  let services:
    ServiceRow[] =
      [];

  if (
    serviceIds.length > 0
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("services")
        .select("id, slug")
        .in(
          "id",
          serviceIds
        );

    if (error) {
      throw new Error(
        "PROVIDER_JOBS_SERVICE_META_FAILED:" +
          error.message
      );
    }

    services =
      (
        data ??
        []
      ) as unknown as
        ServiceRow[];
  }

  const slugByServiceId =
    new Map(
      services.map(
        (item) => [
          item.id,
          item.slug.toLowerCase(),
        ]
      )
    );

  const userServiceByServiceId =
    new Map<
      string,
      string
    >();

  const userServiceBySlug =
    new Map<
      string,
      string
    >();

  for (
    const item
    of userServices
  ) {
    userServiceByServiceId.set(
      item.service_id,
      item.id
    );

    const slug =
      slugByServiceId.get(
        item.service_id
      );

    if (slug) {
      userServiceBySlug.set(
        slug,
        item.id
      );
    }
  }

  const kept:
    JsonRecord[] =
      [];

  let multiChecked =
    0;

  let staleRemoved =
    0;

  let unresolvedRemoved =
    0;

  let validationFailures =
    0;

  let resyncFailures =
    0;

  for (
    const item
    of extraction.items
  ) {
    const id =
      getRequestId(item);

    const requestRow =
      requestById.get(id);

    /*
      Les missions inconnues et les missions
      simples restent gerees par 12.93.
    */
    if (
      !id ||
      !requestRow
    ) {
      kept.push(item);
      continue;
    }

    if (
      !isMultiSlot(
        requestRow,
        item
      )
    ) {
      kept.push(item);
      continue;
    }

    multiChecked += 1;

    const exactServiceId =
      serviceId(
        requestRow
      ) ||
      serviceId(
        item
      );

    const exactSlug =
      serviceSlug(
        requestRow
      ) ||
      serviceSlug(
        item
      );

    const userServiceId =
      (
        exactServiceId
          ? userServiceByServiceId.get(
              exactServiceId
            )
          : undefined
      ) ??
      (
        exactSlug
          ? userServiceBySlug.get(
              exactSlug
            )
          : undefined
      );

    /*
      Mission multi :
      impossible de prouver le service exact
      => fail closed.
    */
    if (!userServiceId) {
      unresolvedRemoved += 1;
      continue;
    }

    const {
      data: coverageData,
      error: coverageError,
    } =
      await supabaseAdmin.rpc(
        "klyx_group_live_coverage_check",
        {
          p_request_id:
            id,

          p_provider_profile_id:
            profile.id,

          p_user_service_id:
            userServiceId,
        }
      );

    if (coverageError) {
      validationFailures += 1;
      continue;
    }

    const live =
      parseCoverage(
        coverageData
      );

    const expectedSlots =
      asPositiveInteger(
        requestRow.slot_count
      ) ||
      asPositiveInteger(
        item.slotCount
      ) ||
      asPositiveInteger(
        item.slot_count
      );

    const exactSlotCount =
      expectedSlots === 0 ||
      expectedSlots ===
        live.slotCount;

    const eligible =
      live.ok &&
      live.fullCoverage &&
      live.slotCount >= 2 &&
      live.coverageCount ===
        live.slotCount &&
      exactSlotCount;

    const synchronized =
      await resyncCandidate({
        requestId:
          id,

        providerProfileId:
          profile.id,

        coverageCount:
          live.coverageCount,

        slotCount:
          live.slotCount,

        fullCoverage:
          eligible,
      });

    if (!synchronized) {
      resyncFailures += 1;
    }

    if (!eligible) {
      staleRemoved += 1;
      continue;
    }

    kept.push({
      ...item,

      coverage: {
        count:
          live.coverageCount,

        total:
          live.slotCount,

        fullCoverage:
          true,

        label:
          String(
            live.coverageCount
          ) +
          "/" +
          String(
            live.slotCount
          ) +
          " disponible",
      },

      liveEligibility: {
        checked:
          true,

        eligible:
          true,

        code:
          live.code,

        checkedAt:
          new Date()
            .toISOString(),
      },
    });
  }

  if (
    extraction.rootArray
  ) {
    return kept;
  }

  const body =
    asRecord(payload);

  if (
    !body ||
    !extraction.key
  ) {
    return payload;
  }

  return {
    ...body,

    [extraction.key]:
      kept,

    liveEligibilityChecked:
      true,

    multiSlotJobsChecked:
      multiChecked,

    staleMultiSlotJobsRemoved:
      staleRemoved,

    unresolvedMultiSlotJobsRemoved:
      unresolvedRemoved,

    liveValidationFailures:
      validationFailures,

    candidateResyncFailures:
      resyncFailures,

    automaticOffer:
      false,

    automaticBooking:
      false,

    automaticPayment:
      false,
  };
}