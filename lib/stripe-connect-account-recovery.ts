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
