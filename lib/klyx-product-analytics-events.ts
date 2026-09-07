export const KLYX_PRODUCT_ANALYTICS_EVENTS = [
  "visit started",
  "account signed up",
  "account signed in",
  "profile created",
  "profile selected",
  "service searched",
  "provider opened",
  "booking started",
  "booking confirmed",
  "booking abandoned",
  "payment confirmed",
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
