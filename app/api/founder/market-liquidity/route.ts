import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { getKlyxMarketLiquidityMetrics } from "@/lib/market-liquidity-server";

function optionalParam(url: URL, key: string): string | null {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : null;
}

function windowBoundary(url: URL, key: "from" | "to"): string {
  const value = optionalParam(url, key);
  if (!value) {
    throw new Error("KLYX_MARKET_LIQUIDITY_TIME_WINDOW_REQUIRED");
  }
  return value;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const url = new URL(request.url);
    const result = await getKlyxMarketLiquidityMetrics({
      from: windowBoundary(url, "from"),
      to: windowBoundary(url, "to"),
      marketId: optionalParam(url, "market"),
      countryCode: optionalParam(url, "country"),
      regionId: optionalParam(url, "region"),
      serviceId: optionalParam(url, "service"),
      currencyCode: optionalParam(url, "currency"),
      priceBandKey: optionalParam(url, "priceBand"),
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_market_liquidity_failed",
      route: "/api/founder/market-liquidity",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_MARKET_LIQUIDITY_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
