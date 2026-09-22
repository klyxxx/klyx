import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { getKlyxMarketLiquidity } from "@/lib/market-liquidity-server";

const ROUTE = "/api/founder/market-liquidity";

function clean(value: string | null, max: number): string | null {
  const normalized = (value ?? "").trim().slice(0, max);
  return normalized || null;
}

function code(value: string | null, length: 2 | 3): string | null {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return new RegExp(`^[A-Z]{${length}}$`).test(normalized)
    ? normalized
    : null;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const url = new URL(request.url);
    const serviceSlug = clean(url.searchParams.get("service"), 120);
    const rawCountry = clean(url.searchParams.get("country"), 2);
    const rawCurrency = clean(url.searchParams.get("currency"), 3);
    const countryCode = code(rawCountry, 2);
    const currencyCode = code(rawCurrency, 3);
    const rawDays = url.searchParams.get("days");
    const days = rawDays === null ? 30 : Number(rawDays);

    if (!serviceSlug) {
      return NextResponse.json(
        {
          error: "Le service est requis.",
          code: "KLYX_LIQUIDITY_SERVICE_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (rawCountry && !countryCode) {
      return NextResponse.json(
        {
          error: "Code pays invalide.",
          code: "KLYX_LIQUIDITY_COUNTRY_INVALID",
        },
        { status: 400 }
      );
    }

    if (rawCurrency && !currencyCode) {
      return NextResponse.json(
        {
          error: "Code devise invalide.",
          code: "KLYX_LIQUIDITY_CURRENCY_INVALID",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return NextResponse.json(
        {
          error: "La fenêtre doit être comprise entre 1 et 365 jours.",
          code: "KLYX_LIQUIDITY_WINDOW_INVALID",
        },
        { status: 400 }
      );
    }

    const result = await getKlyxMarketLiquidity({
      serviceSlug,
      windowDays: days,
      marketKey: clean(url.searchParams.get("market"), 120),
      countryCode,
      regionKey: clean(url.searchParams.get("region"), 160),
      currencyCode,
      priceBandKey: clean(url.searchParams.get("priceBand"), 120),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const founderStatus = founderErrorStatus(error);
    const status =
      founderStatus !== 500
        ? founderStatus
        : message === "KLYX_LIQUIDITY_SERVICE_REQUIRED"
          ? 400
          : message === "KLYX_LIQUIDITY_SERVICE_NOT_FOUND"
            ? 404
            : message === "KLYX_LIQUIDITY_EVENT_WINDOW_TOO_LARGE"
              ? 503
              : 500;

    return secureApiErrorResponse({
      error,
      event: "founder_market_liquidity_load_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_MARKET_LIQUIDITY_LOAD_FAILED",
      publicMessage:
        status === 400
          ? "Le service est requis."
          : status === 404
            ? "Service introuvable."
            : status === 503
              ? "Fenêtre de liquidité trop volumineuse pour ce calcul synchrone."
              : founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
