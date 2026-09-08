"use client";

import type { KlyxProductAnalyticsEvent } from "@/lib/klyx-product-analytics-events";

const KLYX_PRODUCT_ANALYTICS_SESSION_KEY =
  "klyx:product-analytics-session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memorySessionId: string | null = null;

function createAnonymousSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  if (typeof window.crypto?.getRandomValues !== "function") {
    return null;
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function getAnonymousSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(
      KLYX_PRODUCT_ANALYTICS_SESSION_KEY
    );

    if (stored && UUID_PATTERN.test(stored)) {
      return stored;
    }
  } catch {
    // Session storage can be disabled. A memory-only UUID is still anonymous.
  }

  if (memorySessionId && UUID_PATTERN.test(memorySessionId)) {
    return memorySessionId;
  }

  const created = createAnonymousSessionId();
  if (!created) {
    return null;
  }

  memorySessionId = created;

  try {
    window.sessionStorage.setItem(
      KLYX_PRODUCT_ANALYTICS_SESSION_KEY,
      created
    );
  } catch {
    // Analytics must never block KLYX when browser storage is unavailable.
  }

  return created;
}

export function captureKlyxProductEvent(
  event: KlyxProductAnalyticsEvent
): void {
  const sessionId = getAnonymousSessionId();
  if (!sessionId) {
    return;
  }

  void fetch("/api/analytics/product", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, sessionId }),
  }).catch(() => undefined);
}
