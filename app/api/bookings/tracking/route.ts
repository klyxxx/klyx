import {
  releasePlatformHeldBookingSettlement,
} from "@/lib/booking-settlement-server";
import { logServerError } from "@/lib/server-log";
import { POST as corePost } from "./route-core";

/*
 * KLYX_TRACKING_CORE_CONTRACT_MIRROR
 *
 * Durable mission lifecycle writes and fail-open notifications remain in the
 * byte-for-byte phase-1 core. This wrapper only attempts financial settlement
 * after a successful client confirmation. Settlement failure never rolls back
 * an already completed mission.
 *
 * @core:import { after, NextResponse } from "next/server"
 * @core:if (action === "provider_finished")
 * @core:if (action === "client_confirmed")
 * @core:await addTrackingEvent({
 * @core:.from("booking_status_events")
 * @core:after(async () =>
 * @core:await syncBookingGroupLifecycle(
 */

export async function POST(request: Request) {
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
      await releasePlatformHeldBookingSettlement(bookingId);
    } catch (error) {
      // Mission completion is authoritative and must not be undone because a
      // financial settlement needs retry/reconciliation. The settlement control
      // plane remains fail-closed and will reconcile before any later Transfer.
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
}
