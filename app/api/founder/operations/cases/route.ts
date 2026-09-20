import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  assignKlyxHumanOpsCase,
  getKlyxHumanOpsCase,
  linkKlyxHumanOpsCase,
  listKlyxHumanOpsCases,
  openKlyxDlqHumanOpsCase,
  redriveKlyxDeadLetterJob,
  transitionKlyxHumanOpsCase,
  type KlyxHumanOpsPriority,
  type KlyxHumanOpsStatus,
} from "@/lib/human-operations-server";

const ROUTE = "/api/founder/operations/cases";

type Body = {
  action?: unknown;
  caseId?: unknown;
  jobId?: unknown;
  caseKey?: unknown;
  queueKey?: unknown;
  priority?: unknown;
  dueAt?: unknown;
  expectedVersion?: unknown;
  assigneeAuthUserId?: unknown;
  reasonCode?: unknown;
  toStatus?: unknown;
  note?: unknown;
  resourceType?: unknown;
  resourceRef?: unknown;
  relationType?: unknown;
  redriveKey?: unknown;
  availableAt?: unknown;
};

const CASE_STATUSES = new Set<KlyxHumanOpsStatus>([
  "open",
  "triage",
  "in_review",
  "waiting_external",
  "resolved",
  "closed",
]);

const PRIORITIES = new Set<KlyxHumanOpsPriority>([
  "low",
  "normal",
  "high",
  "critical",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function version(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;

  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

function priority(value: unknown): KlyxHumanOpsPriority {
  const normalized = text(value).toLowerCase() as KlyxHumanOpsPriority;
  return PRIORITIES.has(normalized) ? normalized : "high";
}

function status(value: unknown): KlyxHumanOpsStatus | null {
  const normalized = text(value).toLowerCase() as KlyxHumanOpsStatus;
  return CASE_STATUSES.has(normalized) ? normalized : null;
}

function transitionStatus(
  value: unknown
): Exclude<KlyxHumanOpsStatus, "open"> | null {
  const normalized = status(value);
  return normalized && normalized !== "open" ? normalized : null;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId")?.trim() ?? "";

    if (caseId) {
      const detail = await getKlyxHumanOpsCase(caseId);

      if (!detail) {
        return NextResponse.json(
          { error: "Case Operations introuvable." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        case: detail.case,
        links: detail.links,
        redrives: detail.redrives,
        events: detail.events,
        authority: "operations_work_queue_only",
      });
    }

    const statusValues = (url.searchParams.get("status") ?? "")
      .split(",")
      .map((value) => status(value))
      .filter((value): value is KlyxHumanOpsStatus => Boolean(value));

    const limitRaw = Number(url.searchParams.get("limit") ?? "100");
    const limit =
      Number.isSafeInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 500
        ? limitRaw
        : 100;

    const cases = await listKlyxHumanOpsCases({
      statuses: statusValues.length ? statusValues : undefined,
      queueKey: url.searchParams.get("queue"),
      assigneeAuthUserId:
        url.searchParams.get("mine") === "1" ? founder.id : null,
      limit,
    });

    return NextResponse.json({
      cases,
      authority: "operations_work_queue_only",
      domainTruthRemainsExternal: true,
    });
  } catch (error) {
    const statusCode = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_human_operations_cases_read_failed",
      route: ROUTE,
      method: "GET",
      status: statusCode,
      code: "KLYX_FOUNDER_HUMAN_OPS_CASES_READ_FAILED",
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

    if (action === "open_dlq") {
      const jobId = text(body.jobId);
      const caseKey = text(body.caseKey);

      if (!jobId || !caseKey) {
        return NextResponse.json(
          { error: "jobId et caseKey sont obligatoires." },
          { status: 400 }
        );
      }

      const result = await openKlyxDlqHumanOpsCase({
        jobId,
        caseKey,
        queueKey: optionalText(body.queueKey) ?? "operations",
        priority: priority(body.priority),
        dueAt: optionalText(body.dueAt),
      });

      return NextResponse.json({ ok: true, case: result });
    }

    if (action === "claim" || action === "assign") {
      const caseId = text(body.caseId);
      const expectedVersion = version(body.expectedVersion);
      const reasonCode = text(body.reasonCode).toUpperCase();
      const assigneeAuthUserId =
        action === "claim"
          ? founder.id
          : text(body.assigneeAuthUserId);

      if (
        !caseId ||
        expectedVersion === null ||
        !reasonCode ||
        !assigneeAuthUserId
      ) {
        return NextResponse.json(
          {
            error:
              "caseId, expectedVersion, reasonCode et assigneeAuthUserId sont requis.",
          },
          { status: 400 }
        );
      }

      const result = await assignKlyxHumanOpsCase({
        caseId,
        actorAuthUserId: founder.id,
        assigneeAuthUserId,
        expectedVersion,
        reasonCode,
      });

      return NextResponse.json({ ok: true, case: result });
    }

    if (action === "transition") {
      const caseId = text(body.caseId);
      const expectedVersion = version(body.expectedVersion);
      const reasonCode = text(body.reasonCode).toUpperCase();
      const toStatus = transitionStatus(body.toStatus);

      if (
        !caseId ||
        expectedVersion === null ||
        !reasonCode ||
        !toStatus
      ) {
        return NextResponse.json(
          {
            error:
              "caseId, expectedVersion, toStatus et reasonCode sont requis.",
          },
          { status: 400 }
        );
      }

      const result = await transitionKlyxHumanOpsCase({
        caseId,
        operatorAuthUserId: founder.id,
        expectedVersion,
        toStatus,
        reasonCode,
        note: optionalText(body.note),
      });

      return NextResponse.json({ ok: true, case: result });
    }

    if (action === "link") {
      const caseId = text(body.caseId);
      const resourceType = text(body.resourceType);
      const resourceRef = text(body.resourceRef);

      if (!caseId || !resourceType || !resourceRef) {
        return NextResponse.json(
          {
            error: "caseId, resourceType et resourceRef sont requis.",
          },
          { status: 400 }
        );
      }

      const linkId = await linkKlyxHumanOpsCase({
        caseId,
        resourceType,
        resourceRef,
        relationType: optionalText(body.relationType) ?? "related",
        operatorAuthUserId: founder.id,
      });

      return NextResponse.json({ ok: true, linkId });
    }

    if (action === "redrive_dlq") {
      const caseId = text(body.caseId);
      const jobId = text(body.jobId);
      const redriveKey = text(body.redriveKey);
      const reasonCode = text(body.reasonCode).toUpperCase();

      if (!caseId || !jobId || !redriveKey || !reasonCode) {
        return NextResponse.json(
          {
            error:
              "caseId, jobId, redriveKey et reasonCode sont requis.",
          },
          { status: 400 }
        );
      }

      const newJobId = await redriveKlyxDeadLetterJob({
        caseId,
        originalJobId: jobId,
        operatorAuthUserId: founder.id,
        redriveKey,
        reasonCode,
        availableAt: optionalText(body.availableAt),
      });

      return NextResponse.json({
        ok: true,
        originalJobId: jobId,
        newJobId,
        originalRemainsDeadLettered: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "action invalide. Utiliser open_dlq, claim, assign, transition, link ou redrive_dlq.",
      },
      { status: 400 }
    );
  } catch (error) {
    const statusCode = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_human_operations_cases_write_failed",
      route: ROUTE,
      method: "POST",
      status: statusCode,
      code: "KLYX_FOUNDER_HUMAN_OPS_CASES_WRITE_FAILED",
      publicMessage: founderErrorPublicMessage(statusCode),
      startedAt,
    });
  }
}
