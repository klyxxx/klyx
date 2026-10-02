import fs from "node:fs";
import path from "node:path";
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const outDir = path.join(process.cwd(), "reports", "certification");
fs.mkdirSync(outDir, { recursive: true });

const sha = process.env.KLYX_CERT_SHA || process.env.GITHUB_SHA || "unknown";
const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_SECRET:${name}`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalRequest({ method, pathName, timestamp, nonce, body }) {
  return [method.toUpperCase(), pathName, timestamp, nonce, sha256(body)].join("\n");
}

function signedHeaders({ method, pathName, body, secret }) {
  const timestamp = String(Date.now());
  const nonce = randomBytes(18).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(canonicalRequest({ method, pathName, timestamp, nonce, body }), "utf8")
    .digest("hex");

  return {
    "content-type": "application/json",
    "x-klyx-wal-timestamp": timestamp,
    "x-klyx-wal-nonce": nonce,
    "x-klyx-wal-signature": signature,
  };
}

async function request(url, options = {}, timeoutMs = 10_000) {
  return fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function sealProbe({ job, keyId }) {
  const jobType = job.jobType.trim().toLowerCase();
  const idempotencyKey = job.idempotencyKey.trim();
  const operationId = `wal_${sha256(
    `klyx-independent-wal-v1\u0000${jobType}\u0000${idempotencyKey}`
  )}`;
  const idempotencyHash = sha256(idempotencyKey);
  const createdAt = new Date().toISOString();
  const iv = randomBytes(12);

  // Deliberately use an ephemeral probe key. If the external alarm races the
  // cleanup acknowledgement, the production recovery endpoint cannot decrypt
  // or enqueue this synthetic certification payload.
  const probeKey = randomBytes(32);
  const cipher = createCipheriv("aes-256-gcm", probeKey, iv);
  const aad = [1, operationId, createdAt, jobType, idempotencyHash, keyId].join("\n");
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(job), "utf8")),
    cipher.final(),
  ]);

  return {
    schemaVersion: 1,
    operationId,
    createdAt,
    jobType,
    idempotencyHash,
    keyId,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

async function signedRequest({ baseUrl, secret, method, pathName, body = "" }) {
  const response = await request(new URL(pathName, `${baseUrl}/`), {
    method,
    headers: signedHeaders({ method, pathName, body, secret }),
    ...(method === "GET" ? {} : { body }),
  });
  return response;
}

let report;
try {
  const baseUrlRaw = required("KLYX_INDEPENDENT_WAL_URL");
  const hmacSecret = required("KLYX_INDEPENDENT_WAL_HMAC_SECRET");
  const runtimeEncryptionKey = required("KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY");
  const runtimeKeyId = required("KLYX_INDEPENDENT_WAL_KEY_ID");

  const baseUrl = new URL(baseUrlRaw);
  if (baseUrl.protocol !== "https:") {
    throw new Error("KLYX_INDEPENDENT_WAL_CERT_REQUIRES_HTTPS");
  }
  if (Buffer.byteLength(hmacSecret, "utf8") < 32) {
    throw new Error("KLYX_INDEPENDENT_WAL_HMAC_SECRET_INVALID");
  }
  const decodedRuntimeKey = Buffer.from(runtimeEncryptionKey, "base64");
  if (decodedRuntimeKey.length !== 32) {
    throw new Error("KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY_INVALID");
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(runtimeKeyId)) {
    throw new Error("KLYX_INDEPENDENT_WAL_KEY_ID_INVALID");
  }

  const normalizedBaseUrl = baseUrl.toString().replace(/\/$/, "");
  const health = await request(`${normalizedBaseUrl}/v1/health`);
  if (!health.ok) throw new Error(`KLYX_INDEPENDENT_WAL_HEALTH_HTTP_${health.status}`);
  const healthBody = await health.json();
  if (healthBody?.ok !== true || healthBody?.durable !== true) {
    throw new Error("KLYX_INDEPENDENT_WAL_HEALTH_NOT_DURABLE");
  }

  const job = {
    jobType: "certification_probe",
    idempotencyKey: `all-providers:${sha}:${runId}`,
    payload: {
      certification: true,
      sha,
      runId,
      purpose: "prove independent durable capture while canonical Supabase may be unavailable",
    },
    maxAttempts: 1,
    dependency: "supabase",
  };
  const envelope = sealProbe({ job, keyId: `cert-${runtimeKeyId}`.slice(0, 64) });
  const entryPath = `/v1/entries/${encodeURIComponent(envelope.operationId)}`;
  const body = JSON.stringify(envelope);

  const put = await signedRequest({
    baseUrl: normalizedBaseUrl,
    secret: hmacSecret,
    method: "PUT",
    pathName: entryPath,
    body,
  });
  if (!put.ok) throw new Error(`KLYX_INDEPENDENT_WAL_PUT_HTTP_${put.status}`);

  const read = await signedRequest({
    baseUrl: normalizedBaseUrl,
    secret: hmacSecret,
    method: "GET",
    pathName: entryPath,
  });
  if (!read.ok) throw new Error(`KLYX_INDEPENDENT_WAL_GET_HTTP_${read.status}`);
  const stored = await read.json();
  if (stored?.operationId !== envelope.operationId) {
    throw new Error("KLYX_INDEPENDENT_WAL_OPERATION_ID_MISMATCH");
  }
  if (!new Set(["pending", "replicated"]).has(stored?.state)) {
    throw new Error(`KLYX_INDEPENDENT_WAL_UNEXPECTED_STATE:${String(stored?.state)}`);
  }

  const ackBody = JSON.stringify({ operationId: envelope.operationId });
  const ack = await signedRequest({
    baseUrl: normalizedBaseUrl,
    secret: hmacSecret,
    method: "POST",
    pathName: `${entryPath}/replicated`,
    body: ackBody,
  });
  if (!ack.ok) throw new Error(`KLYX_INDEPENDENT_WAL_ACK_HTTP_${ack.status}`);

  report = {
    schemaVersion: 1,
    sha,
    generatedAt: new Date().toISOString(),
    status: "PASS",
    provider: "cloudflare-independent-wal",
    mode: "SAFE_CERTIFICATION_WRITE",
    operationId: envelope.operationId,
    evidence: [
      "external HTTPS health reported durable=true",
      "HMAC-authenticated encrypted Durable Object PUT succeeded",
      "subsequent signed GET proved the same operationId was durably readable",
      "entry acknowledged after proof to prevent synthetic recovery work",
      "ephemeral probe encryption key prevents canonical Supabase enqueue if an alarm races cleanup",
    ],
    safety: {
      stripeLiveWrites: 0,
      financialMutations: 0,
      canonicalSupabaseMutations: 0,
      payload: "synthetic certification-only",
    },
  };
} catch (error) {
  report = {
    schemaVersion: 1,
    sha,
    generatedAt: new Date().toISOString(),
    status: "FAIL",
    provider: "cloudflare-independent-wal",
    mode: "SAFE_CERTIFICATION_WRITE",
    evidence: [error instanceof Error ? error.message : "UNKNOWN_ERROR"],
    safety: {
      stripeLiveWrites: 0,
      financialMutations: 0,
      canonicalSupabaseMutations: 0,
      payload: "synthetic certification-only",
    },
  };
}

const reportPath = path.join(outDir, "independent-wal-network.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (report.status !== "PASS") process.exitCode = 1;
