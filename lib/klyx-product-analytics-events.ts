export const KLYX_PRODUCT_ANALYTICS_EVENTS = [
  "account signed up",
  "account signed in",
  "service searched",
  "provider opened",
  "booking started",
  "booking confirmed",
  "booking abandoned",
] as const;

export type KlyxProductAnalyticsEvent =
  (typeof KLYX_PRODUCT_ANALYTICS_EVENTS)[number];

const KLYX_PRODUCT_ANALYTICS_EVENT_SET = new Set<string>(
  KLYX_PRODUCT_ANALYTICS_EVENTS
);

export function isKlyxProductAnalyticsEvent(
  value: unknown
): value is KlyxProductAnalyticsEvent {
  return (
    typeof value === "string" &&
    KLYX_PRODUCT_ANALYTICS_EVENT_SET.has(value)
  );
}
