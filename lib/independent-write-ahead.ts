import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const KLYX_INDEPENDENT_WAL_SCHEMA_VERSION = 1 as const;
export const KLYX_INDEPENDENT_WAL_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type IndependentWalDurableJobInput = {
  jobType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  priority?: number;
  availableAt?: string | null;
  maxAttempts?: number;
  backoffBaseSeconds?: number;
  backoffMaxSeconds?: number;
  accountId?: string | null;
  domainType?: string | null;
  domainResourceType?: string | null;
  domainResourceId?: string | null;
  failureDomainType?: string | null;
  failureDomainKey?: string | null;
  marketId?: string | null;
  regionId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  paymentProvider?: string | null;
  capability?: string | null;
  dependency?: string | null;
};

export type IndependentWalEnvelopeV1 = {
  schemaVersion: typeof KLYX_INDEPENDENT_WAL_SCHEMA_VERSION;
  operationId: string;
  createdAt: string;
  jobType: string;
  idempotencyHash: string;
  keyId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

export type IndependentWalSignedRequest = {
  timestamp: string;
  nonce: string;
  signature: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedIdentity(input: Pick<IndependentWalDurableJobInput, "jobType" | "idempotencyKey">) {
  const jobType = input.jobType.trim().toLowerCase();
  const idempotencyKey = input.idempotencyKey.trim();

  if (!jobType) {
    throw new Error("KLYX_INDEPENDENT_WAL_JOB_TYPE_REQUIRED");
  }
  if (!idempotencyKey) {
    throw new Error("KLYX_INDEPENDENT_WAL_IDEMPOTENCY_KEY_REQUIRED");
  }

  return { jobType, idempotencyKey };
}

function encryptionKey(value: string): Buffer {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY_REQUIRED");
  }

  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32) {
    throw new Error("KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY_INVALID");
  }
  return key;
}

function hmacSecret(value: string): string {
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, "utf8") < 32) {
    throw new Error("KLYX_INDEPENDENT_WAL_HMAC_SECRET_INVALID");
  }
  return normalized;
}

function envelopeAad(envelope: Pick<
  IndependentWalEnvelopeV1,
  "schemaVersion" | "operationId" | "createdAt" | "jobType" | "idempotencyHash" | "keyId"
>): string {
  return [
    envelope.schemaVersion,
    envelope.operationId,
    envelope.createdAt,
    envelope.jobType,
    envelope.idempotencyHash,
    envelope.keyId,
  ].join("\n");
}

export function deriveIndependentWalOperationId(
  input: Pick<IndependentWalDurableJobInput, "jobType" | "idempotencyKey">
): string {
  const { jobType, idempotencyKey } = normalizedIdentity(input);
  return `wal_${sha256(`klyx-independent-wal-v1\u0000${jobType}\u0000${idempotencyKey}`)}`;
}

export function sealIndependentWalDurableJob(input: {
  job: IndependentWalDurableJobInput;
  encryptionKeyBase64: string;
  keyId: string;
  now?: number;
  iv?: Buffer;
}): IndependentWalEnvelopeV1 {
  const { jobType, idempotencyKey } = normalizedIdentity(input.job);
  const keyId = input.keyId.trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId)) {
    throw new Error("KLYX_INDEPENDENT_WAL_KEY_ID_INVALID");
  }

  const key = encryptionKey(input.encryptionKeyBase64);
  const iv = input.iv ?? randomBytes(12);
  if (iv.length !== 12) {
    throw new Error("KLYX_INDEPENDENT_WAL_IV_INVALID");
  }

  const envelopeBase = {
    schemaVersion: KLYX_INDEPENDENT_WAL_SCHEMA_VERSION,
    operationId: deriveIndependentWalOperationId({ jobType, idempotencyKey }),
    createdAt: new Date(input.now ?? Date.now()).toISOString(),
    jobType,
    idempotencyHash: sha256(idempotencyKey),
    keyId,
  } as const;

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(envelopeAad(envelopeBase), "utf8"));
  const plaintext = Buffer.from(
    JSON.stringify({ ...input.job, jobType, idempotencyKey }),
    "utf8"
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    ...envelopeBase,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function openIndependentWalDurableJob(input: {
  envelope: IndependentWalEnvelopeV1;
  encryptionKeyBase64: string;
}): IndependentWalDurableJobInput {
  const envelope = input.envelope;
  if (envelope.schemaVersion !== KLYX_INDEPENDENT_WAL_SCHEMA_VERSION) {
    throw new Error("KLYX_INDEPENDENT_WAL_SCHEMA_UNSUPPORTED");
  }

  const key = encryptionKey(input.encryptionKeyBase64);
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.authTag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
    throw new Error("KLYX_INDEPENDENT_WAL_ENVELOPE_INVALID");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(envelopeAad(envelope), "utf8"));
  decipher.setAuthTag(authTag);

  let decoded: unknown;
  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    decoded = JSON.parse(plaintext);
  } catch (error) {
    throw new Error("KLYX_INDEPENDENT_WAL_DECRYPT_FAILED", { cause: error });
  }

  if (!decoded || typeof decoded !== "object") {
    throw new Error("KLYX_INDEPENDENT_WAL_PAYLOAD_INVALID");
  }

  const job = decoded as IndependentWalDurableJobInput;
  const { jobType, idempotencyKey } = normalizedIdentity(job);
  if (
    jobType !== envelope.jobType ||
    sha256(idempotencyKey) !== envelope.idempotencyHash ||
    deriveIndependentWalOperationId({ jobType, idempotencyKey }) !== envelope.operationId
  ) {
    throw new Error("KLYX_INDEPENDENT_WAL_IDENTITY_MISMATCH");
  }

  return { ...job, jobType, idempotencyKey };
}

export function canonicalIndependentWalRequest(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
}): string {
  return [
    input.method.trim().toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    sha256(input.body),
  ].join("\n");
}

export function signIndependentWalRequest(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
  secret: string;
}): IndependentWalSignedRequest {
  const secret = hmacSecret(input.secret);
  const signature = createHmac("sha256", secret)
    .update(canonicalIndependentWalRequest(input), "utf8")
    .digest("hex");

  return {
    timestamp: input.timestamp,
    nonce: input.nonce,
    signature,
  };
}

export function verifyIndependentWalRequest(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  secret: string;
  now?: number;
  maxClockSkewMs?: number;
}): boolean {
  let secret: string;
  try {
    secret = hmacSecret(input.secret);
  } catch {
    return false;
  }

  if (!/^\d{13}$/.test(input.timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(input.nonce)) {
    return false;
  }
  const timestamp = Number(input.timestamp);
  const now = input.now ?? Date.now();
  const maxClockSkewMs = input.maxClockSkewMs ?? KLYX_INDEPENDENT_WAL_MAX_CLOCK_SKEW_MS;
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > maxClockSkewMs) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/i.test(input.signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(canonicalIndependentWalRequest(input), "utf8")
    .digest();
  const actual = Buffer.from(input.signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
