function stripeErrorMessages(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];

  const candidate = error as {
    message?: unknown;
    raw?: {
      message?: unknown;
    };
  };
  const messages: string[] = [];

  if (typeof candidate.message === "string") {
    messages.push(candidate.message);
  }

  if (
    typeof candidate.raw?.message === "string" &&
    !messages.includes(candidate.raw.message)
  ) {
    messages.push(candidate.raw.message);
  }

  return messages;
}

function hasStripeErrorMessage(error: unknown, expected: string): boolean {
  return stripeErrorMessages(error).includes(expected);
}

export function isMissingStripeConnectAccount(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    param?: unknown;
    raw?: {
      code?: unknown;
      param?: unknown;
    };
  };
  const code =
    typeof candidate.code === "string"
      ? candidate.code
      : typeof candidate.raw?.code === "string"
        ? candidate.raw.code
        : null;
  const param =
    typeof candidate.param === "string"
      ? candidate.param
      : typeof candidate.raw?.param === "string"
        ? candidate.raw.param
        : null;

  return code === "resource_missing" && (param === null || param === "account");
}

export function isStripeConnectAccountModeMismatch(error: unknown): boolean {
  const messages = stripeErrorMessages(error);

  return messages.some(
    (message) =>
      message ===
        "You tried to create a live mode account link for an account that was created in test mode." ||
      message ===
        "You tried to create a test mode account link for an account that was created in live mode."
  );
}

export function isStripePlatformActivationRequired(error: unknown): boolean {
  return hasStripeErrorMessage(
    error,
    "Your account must be activated in order to create accounts. You can activate your accounts at https://dashboard.stripe.com/account/onboarding."
  );
}

export function isStripePlatformProfileRequired(error: unknown): boolean {
  return hasStripeErrorMessage(
    error,
    "You must complete your platform profile to use Connect and create live connected accounts. Visit your dashboard at https://dashboard.stripe.com/connect/accounts/overview to answer the questionnaire."
  );
}

export function isRecoverableStripeConnectAccountForOnboarding(
  error: unknown
): boolean {
  return (
    isMissingStripeConnectAccount(error) ||
    isStripeConnectAccountModeMismatch(error)
  );
}
