import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { buildProviderIncomeOrchestration } from "@/lib/klyx-orchestration-server";

type IncomeRequestBody = {
  targetAmount?: unknown;
  currency?: unknown;
  dayOfWeek?: unknown;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  maximumDistanceKm?: unknown;
};

function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function dateValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const parsed = new Date(`${clean}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : clean;
}

function timeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(clean);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? clean : null;
}

function cleanCurrency(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback.trim().toUpperCase();
  const clean = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(clean) ? clean : fallback.trim().toUpperCase();
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const body = (await request.json().catch(() => null)) as IncomeRequestBody | null;
    if (!body) {
      return NextResponse.json({ error: "Objectif de revenu invalide." }, { status: 400 });
    }

    const targetAmount = numberInRange(body.targetAmount, 0.01, 1_000_000);
    const dayOfWeek =
      body.dayOfWeek === null || body.dayOfWeek === undefined
        ? null
        : numberInRange(body.dayOfWeek, 0, 6);
    const date =
      body.date === null || body.date === undefined
        ? null
        : dateValue(body.date);
    const startTime =
      body.startTime === null || body.startTime === undefined
        ? null
        : timeValue(body.startTime);
    const endTime =
      body.endTime === null || body.endTime === undefined
        ? null
        : timeValue(body.endTime);
    const maximumDistanceKm =
      body.maximumDistanceKm === null || body.maximumDistanceKm === undefined
        ? null
        : numberInRange(body.maximumDistanceKm, 0, 500);

    if (
      targetAmount === null ||
      (dayOfWeek === null && date === null) ||
      ((startTime === null) !== (endTime === null)) ||
      (startTime !== null && endTime !== null && endTime <= startTime) ||
      (body.dayOfWeek !== null && body.dayOfWeek !== undefined && dayOfWeek === null) ||
      (body.date !== null && body.date !== undefined && date === null) ||
      (body.maximumDistanceKm !== null &&
        body.maximumDistanceKm !== undefined &&
        maximumDistanceKm === null)
    ) {
      return NextResponse.json(
        { error: "Objectif, date/jour, créneau ou distance invalide." },
        { status: 400 }
      );
    }

    const currency = cleanCurrency(body.currency, profile.currencyCode);
    if (currency !== profile.currencyCode.trim().toUpperCase()) {
      return NextResponse.json(
        { error: "La devise de l’objectif doit correspondre à celle du profil." },
        { status: 409 }
      );
    }

    const result = await buildProviderIncomeOrchestration(
      request,
      { id: profile.id, currencyCode: profile.currencyCode },
      {
        targetAmount,
        currency,
        dayOfWeek,
        date,
        startTime,
        endTime,
        maximumDistanceKm,
      }
    );

    return NextResponse.json({ orchestration: result.orchestration });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de préparer les solutions de revenu.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
