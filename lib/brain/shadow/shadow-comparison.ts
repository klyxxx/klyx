export type KlyxShadowComparisonInput = {
  deterministicIntent:
    string | null;

  shadowIntent:
    string | null;

  shadowConfidence:
    number | null;

  shadowAvailable:
    boolean;

  shadowAttempted:
    boolean;
};

export type KlyxShadowComparison = {
  comparable: boolean;

  agreement:
    boolean | null;

  deterministicIntent:
    string | null;

  shadowIntent:
    string | null;

  shadowConfidence:
    number | null;

  confidenceBucket:
    | "none"
    | "low"
    | "medium"
    | "high";

  automaticExecutionAllowed:
    false;

  canInfluenceUserReply:
    false;
};

function normalizeIntent(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value.trim().toLowerCase();

  return normalized || null;
}

function normalizeConfidence(
  value: number | null,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

function buildConfidenceBucket(
  confidence: number | null,
): KlyxShadowComparison["confidenceBucket"] {
  if (confidence === null) {
    return "none";
  }

  if (confidence < 0.5) {
    return "low";
  }

  if (confidence < 0.8) {
    return "medium";
  }

  return "high";
}

export function compareKlyxBrainWithShadow(
  input: KlyxShadowComparisonInput,
): KlyxShadowComparison {
  const deterministicIntent =
    normalizeIntent(
      input.deterministicIntent,
    );

  const shadowIntent =
    normalizeIntent(
      input.shadowIntent,
    );

  const shadowConfidence =
    normalizeConfidence(
      input.shadowConfidence,
    );

  const comparable =
    input.shadowAttempted === true &&
    input.shadowAvailable === true &&
    deterministicIntent !== null &&
    shadowIntent !== null;

  const agreement =
    comparable
      ? deterministicIntent ===
        shadowIntent
      : null;

  return {
    comparable,

    agreement,

    deterministicIntent,

    shadowIntent,

    shadowConfidence,

    confidenceBucket:
      buildConfidenceBucket(
        shadowConfidence,
      ),

    automaticExecutionAllowed:
      false,

    canInfluenceUserReply:
      false,
  };
}