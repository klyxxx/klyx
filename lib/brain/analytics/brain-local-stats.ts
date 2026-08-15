export type KlyxBrainStatSample = {
  ready: boolean;

  missing:
    string[];

  understood:
    boolean;

  ambiguous:
    boolean;

  completeness:
    number;
};

export type KlyxBrainLocalStats = {
  totalSamples:
    number;

  readyCount:
    number;

  understoodCount:
    number;

  ambiguousCount:
    number;

  incompleteCount:
    number;

  readyRate:
    number;

  understoodRate:
    number;

  ambiguityRate:
    number;

  incompleteRate:
    number;

  averageCompleteness:
    number;

  missingFieldFrequency:
    Record<string, number>;

  automaticExecutionAllowed:
    false;

  externalApiRequired:
    false;
};

function safeRate(
  value: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  return value / total;
}

function normalizeCompleteness(
  value: number,
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

export function buildKlyxBrainLocalStats(
  samples: KlyxBrainStatSample[],
): KlyxBrainLocalStats {
  const totalSamples =
    samples.length;

  let readyCount =
    0;

  let understoodCount =
    0;

  let ambiguousCount =
    0;

  let incompleteCount =
    0;

  let completenessTotal =
    0;

  const missingFieldFrequency:
    Record<string, number> =
    {};

  for (
    const sample
    of samples
  ) {
    if (sample.ready) {
      readyCount += 1;
    }

    if (sample.understood) {
      understoodCount += 1;
    }

    if (sample.ambiguous) {
      ambiguousCount += 1;
    }

    if (
      !sample.ready ||
      sample.missing.length > 0
    ) {
      incompleteCount += 1;
    }

    completenessTotal +=
      normalizeCompleteness(
        sample.completeness,
      );

    for (
      const rawField
      of sample.missing
    ) {
      const field =
        rawField
          .trim()
          .toLowerCase();

      if (!field) {
        continue;
      }

      missingFieldFrequency[field] =
        (
          missingFieldFrequency[field] ??
          0
        ) + 1;
    }
  }

  return {
    totalSamples,

    readyCount,

    understoodCount,

    ambiguousCount,

    incompleteCount,

    readyRate:
      safeRate(
        readyCount,
        totalSamples,
      ),

    understoodRate:
      safeRate(
        understoodCount,
        totalSamples,
      ),

    ambiguityRate:
      safeRate(
        ambiguousCount,
        totalSamples,
      ),

    incompleteRate:
      safeRate(
        incompleteCount,
        totalSamples,
      ),

    averageCompleteness:
      safeRate(
        completenessTotal,
        totalSamples,
      ),

    missingFieldFrequency,

    automaticExecutionAllowed:
      false,

    externalApiRequired:
      false,
  };
}