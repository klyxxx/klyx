import { NextResponse } from "next/server";

import { enqueueKlyxDurableJobDirect } from "@/lib/durable-jobs-server";
import {
  openIndependentWalDurableJob,
  verifyIndependentWalRequest,
  type IndependentWalEnvelopeV1,
} from "@/lib/independent-write-ahead";

export const runtime = "nodejs";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`KLYX_INDEPENDENT_WAL_ENV_MISSING:${name}`);
  return value;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const url = new URL(request.url);
  let secret: string;

  try {
    secret = requiredEnv("KLYX_INDEPENDENT_WAL_HMAC_SECRET");
  } catch {
    return NextResponse.json({ error: "wal_not_configured" }, { status: 503 });
  }

  const verified = verifyIndependentWalRequest({
    method: request.method,
    path: url.pathname,
    timestamp: request.headers.get("x-klyx-wal-timestamp") ?? "",
    nonce: request.headers.get("x-klyx-wal-nonce") ?? "",
    signature: request.headers.get("x-klyx-wal-signature") ?? "",
    body: rawBody,
    secret,
  });

  if (!verified) {
    return NextResponse.json({ error: "invalid_wal_signature" }, { status: 401 });
  }

  let envelope: IndependentWalEnvelopeV1;
  try {
    const parsed = JSON.parse(rawBody) as { envelope?: IndependentWalEnvelopeV1 };
    if (!parsed.envelope) throw new Error("missing envelope");
    envelope = parsed.envelope;
  } catch {
    return NextResponse.json({ error: "invalid_wal_payload" }, { status: 400 });
  }

  try {
    const job = openIndependentWalDurableJob({
      envelope,
      encryptionKeyBase64: requiredEnv("KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY"),
    });
    const result = await enqueueKlyxDurableJobDirect(job);

    return NextResponse.json({
      ok: true,
      operationId: envelope.operationId,
      canonicalJobId: result.jobId,
      canonicalStatus: result.status,
    });
  } catch (error) {
    console.error("KLYX independent WAL recovery failed", error);
    return NextResponse.json({ error: "wal_recovery_pending" }, { status: 503 });
  }
}
