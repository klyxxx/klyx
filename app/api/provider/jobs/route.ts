import { NextResponse } from "next/server";

import { GET as getBookingOverview } from "@/app/api/bookings/overview/route";
import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./jobs-route-core";

type ProviderMissionCard = {
  role?: "client" | "provider";
};

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);

    if (!response.ok) {
      if (response.status < 500) {
        return response;
      }

      return secureApiErrorResponse({
        error: new Error(
          "Provider jobs core returned an unexpected 5xx response."
        ),
        event: "provider_jobs_load_failed",
        route: "/api/provider/jobs",
        method: "GET",
        status: response.status,
        code: "KLYX_PROVIDER_JOBS_LOAD_FAILED",
        details: {
          automaticExecutionAllowed: false,
          automaticOffer: false,
          automaticBooking: false,
          automaticPayment: false,
        },
        startedAt,
      });
    }

    const overviewResponse = await getBookingOverview(request);
    if (!overviewResponse.ok) {
      if (overviewResponse.status < 500) {
        return overviewResponse;
      }

      throw new Error("Provider confirmed missions overview unavailable.");
    }

    const body = (await response.json()) as Record<string, unknown>;
    const overview = (await overviewResponse.json()) as {
      cards?: ProviderMissionCard[];
    };
    const confirmedMissions = (overview.cards ?? []).filter(
      (card) => card.role === "provider"
    );

    return NextResponse.json({
      ...body,
      confirmedMissions,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_jobs_load_failed",
      route: "/api/provider/jobs",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_JOBS_LOAD_FAILED",
      details: {
        automaticExecutionAllowed: false,
        automaticOffer: false,
        automaticBooking: false,
        automaticPayment: false,
      },
      startedAt,
    });
  }
}
