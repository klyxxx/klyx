import "server-only";

import {
  validateProviderLiveMultiSlotCoverage,
  type LiveCoverageResult,
} from "@/lib/multi-slot-live-coverage";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_MULTI_PROVIDER_SPLIT_PLAN_12_99

const MAX_LIVE_CANDIDATES =
  24;

const MAX_SPLIT_PROVIDERS =
  3;

type CandidateRow = {
  provider_profile_id:
    string;

  coverage_count:
    number;

  slot_count:
    number;

  full_coverage:
    boolean;
};

type UserServiceRow = {
  id:
    string;

  user_id:
    string;

  service_id:
    string;
};

type ProfileRow = {
  id:
    string;

  first_name:
    | string
    | null;

  last_name:
    | string
    | null;

  avatar_url:
    | string
    | null;
};

type LiveProvider = {
  providerProfileId:
    string;

  userServiceId:
    string;

  providerName:
    string;

  avatarUrl:
    | string
    | null;

  coverageCount:
    number;

  slotCount:
    number;

  coveredPositions:
    number[];

  coverage:
    LiveCoverageResult;
};

export type SplitProviderAssignment = {
  providerProfileId:
    string;

  userServiceId:
    string;

  providerName:
    string;

  avatarUrl:
    | string
    | null;

  slotPositions:
    number[];

  coverageCount:
    number;

  totalSlots:
    number;
};

export type MultiProviderSplitPlan = {
  mode:
    | "single_provider_available"
    | "split_available"
    | "split_unavailable";

  requestId:
    string;

  slotCount:
    number;

  providerCount:
    number;

  fullCoverage:
    boolean;

  coveredPositions:
    number[];

  uncoveredPositions:
    number[];

  providers:
    SplitProviderAssignment[];

  candidateCountChecked:
    number;

  candidateLimitReached:
    boolean;

  maxProviders:
    number;

  automaticExecutionAllowed:
    false;

  automaticBookingAllowed:
    false;

  automaticPaymentAllowed:
    false;

  requiresClientConfirmation:
    true;
};

function displayName(
  profile:
    | ProfileRow
    | undefined
) {
  if (!profile) {
    return "Prestataire KLYX";
  }

  return (
    [
      profile.first_name,
      profile.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Prestataire KLYX"
  );
}

function positions(
  expectedSlotCount:
    number
) {
  return Array.from(
    {
      length:
        expectedSlotCount,
    },
    (
      _,
      index
    ) =>
      index + 1
  );
}

function uniqueSorted(
  values:
    number[]
) {
  return [
    ...new Set(
      values
    ),
  ].sort(
    (
      first,
      second
    ) =>
      first -
      second
  );
}

function unionCoverage(
  providers:
    LiveProvider[]
) {
  return uniqueSorted(
    providers.flatMap(
      (
        provider
      ) =>
        provider.coveredPositions
    )
  );
}

function coversEverything(
  providers:
    LiveProvider[],
  expectedSlotCount:
    number
) {
  return (
    unionCoverage(
      providers
    ).length ===
    expectedSlotCount
  );
}

function combinationsOfTwo(
  providers:
    LiveProvider[]
) {
  const result:
    LiveProvider[][] =
    [];

  for (
    let first = 0;
    first <
    providers.length;
    first += 1
  ) {
    for (
      let second =
        first + 1;
      second <
      providers.length;
      second += 1
    ) {
      result.push([
        providers[first],
        providers[second],
      ]);
    }
  }

  return result;
}

function combinationsOfThree(
  providers:
    LiveProvider[]
) {
  const result:
    LiveProvider[][] =
    [];

  for (
    let first = 0;
    first <
    providers.length;
    first += 1
  ) {
    for (
      let second =
        first + 1;
      second <
      providers.length;
      second += 1
    ) {
      for (
        let third =
          second + 1;
        third <
        providers.length;
        third += 1
      ) {
        result.push([
          providers[first],
          providers[second],
          providers[third],
        ]);
      }
    }
  }

  return result;
}

function combinationScore(
  providers:
    LiveProvider[],
  expectedSlotCount:
    number
) {
  const totalCoverage =
    providers.reduce(
      (
        total,
        provider
      ) =>
        total +
        provider.coverageCount,
      0
    );

  const uniqueCoverage =
    unionCoverage(
      providers
    ).length;

  const overlap =
    totalCoverage -
    uniqueCoverage;

  /*
    Plus de couverture utile,
    moins de chevauchement.

    Le nombre de prestataires est deja
    priorise avant cette fonction.
  */
  return (
    uniqueCoverage *
      1000 +
    totalCoverage *
      10 -
    overlap *
      5 +
    (
      uniqueCoverage ===
      expectedSlotCount
        ? 100000
        : 0
    )
  );
}

function bestCombination(
  combinations:
    LiveProvider[][],
  expectedSlotCount:
    number
) {
  const valid =
    combinations.filter(
      (
        combination
      ) =>
        coversEverything(
          combination,
          expectedSlotCount
        )
    );

  if (
    valid.length ===
    0
  ) {
    return null;
  }

  valid.sort(
    (
      first,
      second
    ) =>
      combinationScore(
        second,
        expectedSlotCount
      ) -
      combinationScore(
        first,
        expectedSlotCount
      )
  );

  return valid[0];
}

function assignSlots(
  selected:
    LiveProvider[],
  expectedSlotCount:
    number
): SplitProviderAssignment[] {
  const assignments =
    new Map<
      string,
      number[]
    >();

  for (
    const provider
    of selected
  ) {
    assignments.set(
      provider.providerProfileId,
      []
    );
  }

  for (
    const position
    of positions(
      expectedSlotCount
    )
  ) {
    const eligible =
      selected.filter(
        (
          provider
        ) =>
          provider.coveredPositions.includes(
            position
          )
      );

    if (
      eligible.length ===
      0
    ) {
      continue;
    }

    /*
      Repartition simple :
      on prefere celui qui a le moins
      de slots deja attribues.

      En egalite, le prestataire avec
      la meilleure couverture globale gagne.
    */
    eligible.sort(
      (
        first,
        second
      ) => {
        const firstAssigned =
          assignments.get(
            first.providerProfileId
          )?.length ??
          0;

        const secondAssigned =
          assignments.get(
            second.providerProfileId
          )?.length ??
          0;

        if (
          firstAssigned !==
          secondAssigned
        ) {
          return (
            firstAssigned -
            secondAssigned
          );
        }

        return (
          second.coverageCount -
          first.coverageCount
        );
      }
    );

    const chosen =
      eligible[0];

    assignments
      .get(
        chosen.providerProfileId
      )
      ?.push(
        position
      );
  }

  return selected
    .map(
      (
        provider
      ) => ({
        providerProfileId:
          provider.providerProfileId,

        userServiceId:
          provider.userServiceId,

        providerName:
          provider.providerName,

        avatarUrl:
          provider.avatarUrl,

        slotPositions:
          assignments.get(
            provider.providerProfileId
          ) ??
          [],

        coverageCount:
          provider.coverageCount,

        totalSlots:
          expectedSlotCount,
      })
    )
    .filter(
      (
        provider
      ) =>
        provider
          .slotPositions
          .length >
        0
    );
}

async function loadCandidateProviders(
  params: {
    requestId:
      string;

    serviceId:
      string;
  }
) {
  const {
    requestId,
    serviceId,
  } = params;

  const {
    data:
      candidateData,

    error:
      candidateError,
  } = await supabaseAdmin
    .from(
      "market_request_provider_candidates"
    )
    .select(
      "provider_profile_id, coverage_count, slot_count, full_coverage"
    )
    .eq(
      "market_request_id",
      requestId
    )
    .order(
      "coverage_count",
      {
        ascending:
          false,
      }
    )
    .limit(
      MAX_LIVE_CANDIDATES
    );

  if (
    candidateError
  ) {
    throw new Error(
      candidateError.message
    );
  }

  const candidates =
    (
      candidateData ??
      []
    ) as unknown as
      CandidateRow[];

  let providerIds =
    [
      ...new Set(
        candidates.map(
          (
            candidate
          ) =>
            candidate
              .provider_profile_id
        )
      ),
    ];

  /*
    Fallback uniquement si le cache candidat
    est vide.

    On ne veut pas scanner toute la plateforme
    si le matching 12.83 a deja produit
    une liste de candidats.
  */
  if (
    providerIds.length ===
    0
  ) {
    const {
      data:
        fallbackData,

      error:
        fallbackError,
    } = await supabaseAdmin
      .from(
        "user_services"
      )
      .select(
        "id, user_id, service_id"
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
      )
      .limit(
        MAX_LIVE_CANDIDATES
      );

    if (
      fallbackError
    ) {
      throw new Error(
        fallbackError.message
      );
    }

    const services =
      (
        fallbackData ??
        []
      ) as unknown as
        UserServiceRow[];

    return {
      userServices:
        services,

      candidateLimitReached:
        services.length >=
        MAX_LIVE_CANDIDATES,
    };
  }

  providerIds =
    providerIds.slice(
      0,
      MAX_LIVE_CANDIDATES
    );

  const {
    data:
      serviceData,

    error:
      serviceError,
  } = await supabaseAdmin
    .from(
      "user_services"
    )
    .select(
      "id, user_id, service_id"
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
    )
    .in(
      "user_id",
      providerIds
    );

  if (
    serviceError
  ) {
    throw new Error(
      serviceError.message
    );
  }

  return {
    userServices:
      (
        serviceData ??
        []
      ) as unknown as
        UserServiceRow[],

    candidateLimitReached:
      candidates.length >=
      MAX_LIVE_CANDIDATES,
  };
}

export async function buildLiveMultiProviderSplitPlan(
  params: {
    requestId:
      string;

    serviceId:
      string;

    expectedSlotCount:
      number;
  }
): Promise<MultiProviderSplitPlan> {
  const {
    requestId,
    serviceId,
    expectedSlotCount,
  } = params;

  if (
    !Number.isInteger(
      expectedSlotCount
    ) ||
    expectedSlotCount < 2 ||
    expectedSlotCount > 20
  ) {
    throw new Error(
      "Nombre de creneaux multi-slot invalide."
    );
  }

  const {
    userServices,
    candidateLimitReached,
  } =
    await loadCandidateProviders({
      requestId,
      serviceId,
    });

  const providerIds =
    [
      ...new Set(
        userServices.map(
          (
            service
          ) =>
            service.user_id
        )
      ),
    ];

  const {
    data:
      profileData,

    error:
      profileError,
  } = providerIds.length >
    0
    ? await supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          "id, first_name, last_name, avatar_url"
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
      profileError.message
    );
  }

  const profiles =
    (
      profileData ??
      []
    ) as unknown as
      ProfileRow[];

  const profileMap =
    new Map(
      profiles.map(
        (
          profile
        ) => [
          profile.id,
          profile,
        ]
      )
    );

  /*
    Chaque candidat est revalide LIVE.

    Le cache 12.83 peut etre vieux :
    on ne l utilise jamais comme verite finale.
  */
  const coverageResults =
    await Promise.all(
      userServices.map(
        async (
          userService
        ) => {
          const coverage =
            await validateProviderLiveMultiSlotCoverage({
              requestId,

              providerProfileId:
                userService.user_id,

              userServiceId:
                userService.id,

              expectedSlotCount,
            });

          const coveredPositions =
            coverage.slots
              .filter(
                (
                  slot
                ) =>
                  slot.covered
              )
              .map(
                (
                  slot
                ) =>
                  slot.position
              );

          return {
            providerProfileId:
              userService.user_id,

            userServiceId:
              userService.id,

            providerName:
              displayName(
                profileMap.get(
                  userService.user_id
                )
              ),

            avatarUrl:
              profileMap.get(
                userService.user_id
              )?.avatar_url ??
              null,

            coverageCount:
              coveredPositions.length,

            slotCount:
              expectedSlotCount,

            coveredPositions:
              uniqueSorted(
                coveredPositions
              ),

            coverage,
          } satisfies LiveProvider;
        }
      )
    );

  const usefulProviders =
    coverageResults
      .filter(
        (
          provider
        ) =>
          provider.coverageCount >
          0
      )
      .sort(
        (
          first,
          second
        ) =>
          second.coverageCount -
          first.coverageCount
      );

  /*
    Invariant produit :
    un seul prestataire reste toujours
    prioritaire sur un split.
  */
  const fullProvider =
    usefulProviders.find(
      (
        provider
      ) =>
        provider.coverage.fullCoverage &&
        provider.coverageCount ===
          expectedSlotCount
    );

  if (fullProvider) {
    return {
      mode:
        "single_provider_available",

      requestId,

      slotCount:
        expectedSlotCount,

      providerCount: 1,

      fullCoverage:
        true,

      coveredPositions:
        positions(
          expectedSlotCount
        ),

      uncoveredPositions:
        [],

      providers:
        assignSlots(
          [
            fullProvider,
          ],
          expectedSlotCount
        ),

      candidateCountChecked:
        coverageResults.length,

      candidateLimitReached,

      maxProviders:
        MAX_SPLIT_PROVIDERS,

      automaticExecutionAllowed:
        false,

      automaticBookingAllowed:
        false,

      automaticPaymentAllowed:
        false,

      requiresClientConfirmation:
        true,
    };
  }

  /*
    On cherche d abord 2 prestataires.
    Seulement si impossible, on teste 3.

    Cela minimise le nombre de personnes
    necessaires a la mission.
  */
  let selected =
    bestCombination(
      combinationsOfTwo(
        usefulProviders
      ),
      expectedSlotCount
    );

  if (!selected) {
    selected =
      bestCombination(
        combinationsOfThree(
          usefulProviders
        ),
        expectedSlotCount
      );
  }

  if (selected) {
    const covered =
      unionCoverage(
        selected
      );

    return {
      mode:
        "split_available",

      requestId,

      slotCount:
        expectedSlotCount,

      providerCount:
        selected.length,

      fullCoverage:
        covered.length ===
        expectedSlotCount,

      coveredPositions:
        covered,

      uncoveredPositions:
        positions(
          expectedSlotCount
        ).filter(
          (
            position
          ) =>
            !covered.includes(
              position
            )
        ),

      providers:
        assignSlots(
          selected,
          expectedSlotCount
        ),

      candidateCountChecked:
        coverageResults.length,

      candidateLimitReached,

      maxProviders:
        MAX_SPLIT_PROVIDERS,

      automaticExecutionAllowed:
        false,

      automaticBookingAllowed:
        false,

      automaticPaymentAllowed:
        false,

      requiresClientConfirmation:
        true,
    };
  }

  const covered =
    unionCoverage(
      usefulProviders
    );

  return {
    mode:
      "split_unavailable",

    requestId,

    slotCount:
      expectedSlotCount,

    providerCount: 0,

    fullCoverage:
      false,

    coveredPositions:
      covered,

    uncoveredPositions:
      positions(
        expectedSlotCount
      ).filter(
        (
          position
        ) =>
          !covered.includes(
            position
          )
      ),

    providers:
      [],

    candidateCountChecked:
      coverageResults.length,

    candidateLimitReached,

    maxProviders:
      MAX_SPLIT_PROVIDERS,

    automaticExecutionAllowed:
      false,

    automaticBookingAllowed:
      false,

    automaticPaymentAllowed:
      false,

    requiresClientConfirmation:
      true,
  };
}