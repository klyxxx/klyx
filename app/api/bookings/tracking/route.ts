import {
  releasePlatformHeldBookingGroupSettlement,
} from "@/lib/booking-group-settlement-server";
import {
  syncBookingGroupLifecycle,
} from "@/lib/booking-group-lifecycle";
import {
  reconcilePlatformHeldBookingSettlement,
} from "@/lib/booking-settlement-reconciliation-server";
import { secureApiErrorResponse } from "@/lib/api-error";
import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { POST as corePost } from "./route-core";

/*
 * KLYX_TRACKING_CORE_CONTRACT_MIRROR
 *
 * Durable mission lifecycle writes and fail-open notifications remain in the
 * phase-1 core. This wrapper performs financial settlement only after a
 * successful client confirmation. A settlement failure never rolls back
 * completed mission truth.
 *
 * Single booking: Recovery/Reconciliation from #813 remains authoritative.
 * Booking group: lifecycle must be fully completed before the group settlement
 * release is attempted.
 *
 * @core:if (action === "provider_finished")
 * @core:if (action === "client_confirmed")
 * @core:await addTrackingEvent({
 * @core:.from("booking_status_events")
 * @core:after(async () =>
 * @core:await syncBookingGroupLifecycle(
 */

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.clone().json().catch(() => null)) as {
      bookingId?: string;
      action?: string;
      status?: string;
    } | null;

    const response = await corePost(request);
    const action = body?.action ?? body?.status;
    const bookingId = body?.bookingId?.trim() ?? "";

    if (
      response.status >= 200 &&
      response.status < 300 &&
      action === "client_confirmed" &&
      bookingId
    ) {
      try {
        const { data: booking, error } = await supabaseAdmin
          .from("bookings")
          .select("booking_group_id")
          .eq("id", bookingId)
          .maybeSingle();

        if (error) throw new Error(error.message);

        const groupId = booking?.booking_group_id?.trim() ?? "";

        if (groupId) {
          const progress = await syncBookingGroupLifecycle(groupId);

          if (progress?.allCompleted) {
            await releasePlatformHeldBookingGroupSettlement(groupId);
          }
        } else {
          const settlement = await reconcilePlatformHeldBookingSettlement({
            bookingId,
            source: "release",
          });

          if (
            settlement.status === "failed" ||
            settlement.status === "human_review"
          ) {
            logServerError({
              event: "platform_held_settlement_reconciliation_attention",
              route: "/api/bookings/tracking",
              method: "POST",
              status: 500,
              code:
                settlement.reasonCode ??
                "platform_held_settlement_reconciliation_attention",
              error: new Error(
                settlement.reasonCode ??
                  "Platform-held settlement requires reconciliation attention."
              ),
            });
          }
        }
      } catch (error) {
        logServerError({
          event: "platform_held_settlement_release_failed",
          route: "/api/bookings/tracking",
          method: "POST",
          status: 500,
          code: "platform_held_settlement_release_failed",
          error,
        });
      }
    }

    return response;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "booking_tracking_wrapper_failed",
      route: "/api/bookings/tracking",
      method: "POST",
      status: 500,
      code: "booking_tracking_wrapper_failed",
      startedAt,
    });
  }
}
