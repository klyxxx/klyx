import { createHash } from "node:crypto";

type RetryableDeliveryStatus = "sending" | "failed";

function normalizeAttempt(attempts: number): number {
  if (!Number.isFinite(attempts)) return 1;
  return Math.max(1, Math.trunc(attempts));
}

export function nextEmailDeliveryAttempt(
  status: RetryableDeliveryStatus,
  attempts: number
): number {
  const currentAttempt = normalizeAttempt(attempts);
  return status === "failed" ? currentAttempt + 1 : currentAttempt;
}

export function buildEmailProviderIdempotencyKey(
  deduplicationKey: string,
  deliveryAttempt: number
): string {
  const digest = createHash("sha256")
    .update(`${deduplicationKey.trim()}:${normalizeAttempt(deliveryAttempt)}`)
    .digest("hex");

  return `klyx-email-${digest}`;
}
