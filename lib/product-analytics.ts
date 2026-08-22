import "server-only";

import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ProductMetricKey =
  | "provider_search_with_results"
  | "provider_search_no_results";

/**
 * Records one aggregate product event without accepting any actor,
 * request text, location, IP address or browser identifier.
 *
 * Analytics is deliberately fail-open: an unavailable metric must never
 * break the user-facing KLYX flow it observes.
 */
export async function recordAggregateProductMetric(
  metricKey: ProductMetricKey
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc(
      "klyx_increment_product_metric",
      { p_metric_key: metricKey }
    );

    if (error) {
      throw error;
    }
  } catch (error) {
    logServerError({
      error,
      event: "product_analytics_increment_failed",
      route: "product-analytics",
      method: "POST",
      status: 500,
      code: "KLYX_PRODUCT_ANALYTICS_INCREMENT_FAILED",
      durationMs: 0,
    });
  }
}
