export type BrainConfirmationMode =
  | "single"
  | "multi_slot";

type UnknownRecord =
  Record<string, unknown>;

function record(
  value: unknown
): UnknownRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function hasOwn(
  value: UnknownRecord,
  key: string
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

function confirmationRequest(
  payload: unknown
) {
  const root =
    record(payload);

  if (!root) {
    return null;
  }

  return (
    record(root.request) ??
    record(root.requestSnapshot) ??
    record(root.snapshot) ??
    root
  );
}

export function readBrainConfirmationMode(
  payload: unknown
): BrainConfirmationMode | null {
  const request =
    confirmationRequest(payload);

  if (!request) {
    return null;
  }

  const mode =
    request.requestMode ??
    request.request_mode;

  return (
    mode === "single" ||
    mode === "multi_slot"
  )
    ? mode
    : null;
}

export function brainConfirmationModeMatches(
  payload: unknown,
  expected: BrainConfirmationMode
) {
  const request =
    confirmationRequest(payload);

  if (!request) {
    return false;
  }

  const hasExplicitMode =
    hasOwn(request, "requestMode") ||
    hasOwn(request, "request_mode");

  if (hasExplicitMode) {
    return (
      readBrainConfirmationMode(payload) ===
      expected
    );
  }

  // Legacy confirmations created before requestMode was persisted
  // were single requests. Multi-slot confirmations have always
  // carried an explicit mode and schedule, so legacy fallback is
  // allowed only for a schedule-free single request.
  return (
    expected === "single" &&
    !hasOwn(request, "schedule") &&
    request.multiSlot !== true &&
    request.multi_slot !== true
  );
}
