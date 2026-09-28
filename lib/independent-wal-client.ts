import "server-only";

import { randomBytes } from "node:crypto";

import {
  sealIndependentWalDurableJob,
  signIndependentWalRequest,
  type IndependentWalDurableJobInput,
  type IndependentWalEnvelopeV1,
} from "@/lib/independent-write-ahead";
import { fetchWithProviderRecovery } from "@/lib/provider-http-recovery";

export type IndependentWalRuntimeConfig = {
  baseUrl: string;
  hmacSecret: string;
  encryptionKeyBase64: string;
  keyId: string;
};

type IndependentWalRequestDeps = {
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
  now?: number;
  nonce?: string;
  iv?: Buffer;
};

const CONFIG_KEYS = [
  "KLYX_INDEPENDENT_WAL_URL",
  "KLYX_INDEPENDENT_WAL_HMAC_SECRET",
  "KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY",
  "KLYX_INDEPENDENT_WAL_KEY_ID",
] as const;

function requiredFlag(env: NodeJS.ProcessEnv): boolean {
  return env.KLYX_INDEPENDENT_WAL_REQUIRED?.trim().toLowerCase() === "true";
}

export function resolveIndependentWalConfig(
  env: NodeJS.ProcessEnv = process.env
): IndependentWalRuntimeConfig | null {
  const values = CONFIG_KEYS.map((key) => env[key]?.trim() ?? "");
  const present = values.filter(Boolean).length;

  if (present === 0) {
    if (requiredFlag(env)) {
      throw new Error("KLYX_INDEPENDENT_WAL_CONFIG_REQUIRED");
    }
    return null;
  }

  if (present !== CONFIG_KEYS.length) {
    throw new Error("KLYX_INDEPENDENT_WAL_CONFIG_INCOMPLETE");
  }

  const [baseUrlRaw, hmacSecret, encryptionKeyBase64, keyId] = values;
  const url = new URL(baseUrlRaw);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !local) {
    throw new Error("KLYX_INDEPENDENT_WAL_URL_INSECURE");
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ""),
    hmacSecret,
    encryptionKeyBase64,
    keyId,
  };
}

function requestHeaders(input: {
  method: string;
  path: string;
  body: string;
  secret: string;
  now?: number;
  nonce?: string;
}): Record<string, string> {
  const timestamp = String(input.now ?? Date.now());
  const nonce = input.nonce ?? randomBytes(18).toString("base64url");
  const signed = signIndependentWalRequest({
    method: input.method,
    path: input.path,
    timestamp,
    nonce,
    body: input.body,
    secret: input.secret,
  });

  return {
    "content-type": "application/json",
    "x-klyx-wal-timestamp": signed.timestamp,
    "x-klyx-wal-nonce": signed.nonce,
    "x-klyx-wal-signature": signed.signature,
  };
}

async function sendWalRequest(input: {
  config: IndependentWalRuntimeConfig;
  method: "PUT" | "POST";
  path: string;
  body: string;
  operation: string;
  deps?: IndependentWalRequestDeps;
}): Promise<Response> {
  const url = new URL(input.path, `${input.config.baseUrl}/`);
  const response = await fetchWithProviderRecovery(
    url,
    {
      method: input.method,
      cache: "no-store",
      headers: requestHeaders({
        method: input.method,
        path: url.pathname,
        body: input.body,
        secret: input.config.hmacSecret,
        now: input.deps?.now,
        nonce: input.deps?.nonce,
      }),
      body: input.body,
    },
    {
      provider: "cloudflare_independent_wal",
      operation: input.operation,
      replaySafety: "idempotent",
      timeoutMs: 5_000,
      maxAttempts: 3,
      fetchImpl: input.deps?.fetchImpl,
      sleepImpl: input.deps?.sleepImpl,
    }
  );

  if (!response.ok) {
    throw new Error(`KLYX_INDEPENDENT_WAL_HTTP_${response.status}`);
  }

  return response;
}

export async function writeIndependentWalJobWithConfig(input: {
  job: IndependentWalDurableJobInput;
  config: IndependentWalRuntimeConfig;
  deps?: IndependentWalRequestDeps;
}): Promise<IndependentWalEnvelopeV1> {
  const envelope = sealIndependentWalDurableJob({
    job: input.job,
    encryptionKeyBase64: input.config.encryptionKeyBase64,
    keyId: input.config.keyId,
    now: input.deps?.now,
    iv: input.deps?.iv,
  });
  const body = JSON.stringify(envelope);

  await sendWalRequest({
    config: input.config,
    method: "PUT",
    path: `/v1/entries/${encodeURIComponent(envelope.operationId)}`,
    body,
    operation: "prewrite",
    deps: input.deps,
  });

  return envelope;
}

export async function acknowledgeIndependentWalJobWithConfig(input: {
  operationId: string;
  config: IndependentWalRuntimeConfig;
  deps?: IndependentWalRequestDeps;
}): Promise<void> {
  const body = JSON.stringify({ operationId: input.operationId });
  await sendWalRequest({
    config: input.config,
    method: "POST",
    path: `/v1/entries/${encodeURIComponent(input.operationId)}/replicated`,
    body,
    operation: "acknowledge",
    deps: input.deps,
  });
}

export async function persistIndependentWalJob(
  job: IndependentWalDurableJobInput
): Promise<{ operationId: string; config: IndependentWalRuntimeConfig } | null> {
  const config = resolveIndependentWalConfig();
  if (!config) return null;

  const envelope = await writeIndependentWalJobWithConfig({ job, config });
  return { operationId: envelope.operationId, config };
}

export async function acknowledgeIndependentWalJob(input: {
  operationId: string;
  config: IndependentWalRuntimeConfig;
}): Promise<void> {
  await acknowledgeIndependentWalJobWithConfig(input);
}
