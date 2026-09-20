import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  closeKlyxIncidentCircuitBreaker,
  getKlyxOpsIncident,
  listKlyxOpsIncidents,
  openKlyxIncidentCircuitBreaker,
  openKlyxOpsIncident,
  transitionKlyxOpsIncident,
  type KlyxOpsIncidentSeverity,
  type KlyxOpsIncidentStatus,
} from "@/lib/incident-engine-server";

const ROUTE = "/api/founder/operations/incidents";

type Body = {
  action?: unknown;
  incidentId?: unknown;
  incidentKey?: unknown;
  sourceType?: unknown;
  sourceRef?: unknown;
  severity?: unknown;
  reasonCode?: unknown;
  title?: unknown;
  summary?: unknown;
  expectedVersion?: unknown;
  toStatus?: unknown;
  note?: unknown;
  expiresAt?: unknown;
  marketId?: unknown;
  regionId?: unknown;
  countryCode?: unknown;
  currency?: unknown;
  paymentProvider?: unknown;
  capability?: unknown;
  dependency?: unknown;
};

const SEVERITIES = new Set<KlyxOpsIncidentSeverity>([
  "warning",
  "error",
  "critical",
]);

const STATUSES = new Set<KlyxOpsIncidentStatus>([
  "open",
  "acknowledged",
  "mitigating",
  "resolved",
  "closed",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function severity(value: unknown): KlyxOpsIncidentSeverity | null {
  const normalized = text(value).toLowerCase() as KlyxOpsIncidentSeverity;
  return SEVERITIES.has(normalized) ? normalized : null;
}

function status(value: unknown): KlyxOpsIncidentStatus | null {
  const normalized = text(value).toLowerCase() as KlyxOpsIncidentStatus;
  return STATUSES.has(normalized) ? normalized : null;
}

function version(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

function parseExpiry(value: unknown): string | null {
  const raw = optionalText(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("KLYX_OPS_INCIDENT_EXPIRES_AT_INVALID");
  }

  return parsed.toISOString();
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();
    const url = new URL(request.url);
    const incidentId = url.searchParams.get("incidentId")?.trim() ?? "";

    if (incidentId) {
      const detail = await getKlyxOpsIncident(incidentId);
      if (!detail) {
        return NextResponse.json(
          { error: "Incident Operations introuvable." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...detail,
        authority: "operations_incident_coordination_only",
        enforcementAuthority: "ops_capability_controls",
      });
    }

    const statuses = (url.searchParams.get("status") ?? "")
      .split(",")
      .map((value) => status(value))
      .filter((value): value is KlyxOpsIncidentStatus => Boolean(value));

    const severityValue = severity(url.searchParams.get("severity"));
    const limitRaw = Number(url.searchParams.get("limit") ?? "100");
    const limit =
      Number.isSafeInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 500
        ? limitRaw
        : 100;

    const incidents = await listKlyxOpsIncidents({
      statuses: statuses.length ? statuses : undefined,
      severity: severityValue,
      limit,
    });

    return NextResponse.json({
      incidents,
      authority: "operations_incident_coordination_only",
      enforcementAuthority: "ops_capability_controls",
    });
  } catch (error) {
    const statusCode = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_operations_incidents_read_failed",
      route: ROUTE,
      method: "GET",
      status: statusCode,
      code: "KLYX_FOUNDER_OPERATIONS_INCIDENTS_READ_FAILED",
      publicMessage: founderErrorPublicMessage(statusCode),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as Body;
    const action = text(body.action).toLowerCase();

    if (action === "open") {
      const incidentKey = text(body.incidentKey);
      const sourceType = text(body.sourceType);
      const sourceRef = text(body.sourceRef);
      const severityValue = severity(body.severity);
      const reasonCode = text(body.reasonCode).toUpperCase();
      const title = text(body.title);
      const summary = text(body.summary);

      if (
        !incidentKey ||
        !sourceType ||
        !sourceRef ||
        !severityValue ||
        !reasonCode ||
        !title ||
        !summary
      ) {
        return NextResponse.json(
          {
            error:
              "incidentKey, sourceType, sourceRef, severity, reasonCode, title et summary sont requis.",
          },
          { status: 400 }
        );
      }

      const result = await openKlyxOpsIncident({
        incidentKey,
        sourceType,
        sourceRef,
        severity: severityValue,
        reasonCode,
        title,
        summary,
        operatorAuthUserId: founder.id,
        scope: {
          marketId: optionalText(body.marketId),
          regionId: optionalText(body.regionId),
          countryCode: optionalText(body.countryCode),
          currency: optionalText(body.currency),
          paymentProvider: optionalText(body.paymentProvider),
          capability: optionalText(body.capability),
          dependency: optionalText(body.dependency),
        },
      });

      return NextResponse.json({ ok: true, incident: result });
    }

    if (action === "transition") {
      const incidentId = text(body.incidentId);
      const expectedVersion = version(body.expectedVersion);
      const toStatus = status(body.toStatus);
      const reasonCode = text(body.reasonCode).toUpperCase();

      if (
        !incidentId ||
        expectedVersion === null ||
        !toStatus ||
        toStatus === "open" ||
        !reasonCode
      ) {
        return NextResponse.json(
          {
            error:
              "incidentId, expectedVersion, toStatus et reasonCode sont requis.",
          },
          { status: 400 }
        );
      }

      const result = await transitionKlyxOpsIncident({
        incidentId,
        operatorAuthUserId: founder.id,
        expectedVersion,
        toStatus,
        reasonCode,
        note: optionalText(body.note),
      });

      return NextResponse.json({ ok: true, incident: result });
    }

    if (action === "open_circuit") {
      const incidentId = text(body.incidentId);
      const expectedVersion = version(body.expectedVersion);
      const reasonCode = text(body.reasonCode).toUpperCase();

      if (!incidentId || expectedVersion === null || !reasonCode) {
        return NextResponse.json(
          {
            error:
              "incidentId, expectedVersion et reasonCode sont requis.",
          },
          { status: 400 }
        );
      }

      const result = await openKlyxIncidentCircuitBreaker({
        incidentId,
        operatorAuthUserId: founder.id,
        expectedVersion,
        reasonCode,
        expiresAt: parseExpiry(body.expiresAt),
      });

      return NextResponse.json({
        ok: true,
        circuitBreaker: result,
        enforcementAuthority: "ops_capability_controls",
      });
    }

    if (action === "close_circuit") {
      const incidentId = text(body.incidentId);
      const expectedVersion = version(body.expectedVersion);
      const reasonCode = text(body.reasonCode).toUpperCase();

      if (!incidentId || expectedVersion === null || !reasonCode) {
        return NextResponse.json(
          {
            error:
              "incidentId, expectedVersion et reasonCode sont requis.",
          },
          { status: 400 }
        );
      }

      const result = await closeKlyxIncidentCircuitBreaker({
        incidentId,
        operatorAuthUserId: founder.id,
        expectedVersion,
        reasonCode,
      });

      return NextResponse.json({
        ok: true,
        circuitBreaker: result,
        enforcementAuthority: "ops_capability_controls",
      });
    }

    return NextResponse.json(
      {
        error:
          "action invalide. Utiliser open, transition, open_circuit ou close_circuit.",
      },
      { status: 400 }
    );
  } catch (error) {
    const statusCode = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_operations_incidents_write_failed",
      route: ROUTE,
      method: "POST",
      status: statusCode,
      code: "KLYX_FOUNDER_OPERATIONS_INCIDENTS_WRITE_FAILED",
      publicMessage: founderErrorPublicMessage(statusCode),
      startedAt,
    });
  }
}
