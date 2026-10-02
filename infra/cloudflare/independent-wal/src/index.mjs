import { DurableObject } from "cloudflare:workers";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const REPLICATED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqualHex(first, second) {
  if (!/^[0-9a-f]{64}$/i.test(first) || !/^[0-9a-f]{64}$/i.test(second)) return false;
  let diff = 0;
  for (let index = 0; index < first.length; index += 1) {
    diff |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return diff === 0;
}

async function canonicalRequest(request, body, timestamp, nonce) {
  const url = new URL(request.url);
  return [
    request.method.toUpperCase(),
    url.pathname,
    timestamp,
    nonce,
    await sha256Hex(body),
  ].join("\n");
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function retryDelayMs(attempt) {
  return Math.min(5 * 60 * 1000, 1000 * 2 ** Math.min(attempt, 8));
}

export class KlyxIndependentWal extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async verifyRequest(request, body) {
    const secret = String(this.env.KLYX_INDEPENDENT_WAL_HMAC_SECRET || "");
    if (encoder.encode(secret).byteLength < 32) return false;

    const timestamp = request.headers.get("x-klyx-wal-timestamp") || "";
    const nonce = request.headers.get("x-klyx-wal-nonce") || "";
    const signature = request.headers.get("x-klyx-wal-signature") || "";
    if (!/^\d{13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return false;
    const numericTimestamp = Number(timestamp);
    if (!Number.isSafeInteger(numericTimestamp) || Math.abs(Date.now() - numericTimestamp) > MAX_CLOCK_SKEW_MS) return false;

    const expected = await hmacHex(secret, await canonicalRequest(request, body, timestamp, nonce));
    if (!safeEqualHex(expected, signature)) return false;

    let accepted = false;
    await this.ctx.storage.transaction(async (txn) => {
      const nonceKey = `nonce:${nonce}`;
      if (await txn.get(nonceKey)) return;
      await txn.put(nonceKey, Date.now() + MAX_CLOCK_SKEW_MS);
      accepted = true;
    });
    return accepted;
  }

  async scheduleAlarm(at) {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || at < current) await this.ctx.storage.setAlarm(at);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/v1/health") {
      return json({ ok: true, service: "klyx-independent-wal", durable: true });
    }

    const body = await request.text();
    if (!(await this.verifyRequest(request, body))) {
      return json({ error: "unauthorized" }, 401);
    }

    const entryMatch = url.pathname.match(/^\/v1\/entries\/(wal_[0-9a-f]{64})$/);
    const replicatedMatch = url.pathname.match(/^\/v1\/entries\/(wal_[0-9a-f]{64})\/replicated$/);

    if (request.method === "PUT" && entryMatch) {
      let envelope;
      try {
        envelope = JSON.parse(body);
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      const operationId = entryMatch[1];
      if (!envelope || envelope.operationId !== operationId || envelope.schemaVersion !== 1) {
        return json({ error: "identity_mismatch" }, 409);
      }

      const key = `entry:${operationId}`;
      let created = false;
      await this.ctx.storage.transaction(async (txn) => {
        const existing = await txn.get(key);
        if (existing) return;
        await txn.put(key, {
          operationId,
          envelope,
          state: "pending",
          createdAt: Date.now(),
          replicatedAt: null,
          attemptCount: 0,
          nextAttemptAt: Date.now() + 1000,
        });
        created = true;
      });
      await this.scheduleAlarm(Date.now() + 1000);
      return json({ ok: true, created, operationId });
    }

    if (request.method === "POST" && replicatedMatch) {
      const operationId = replicatedMatch[1];
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      if (parsed?.operationId !== operationId) return json({ error: "identity_mismatch" }, 409);

      const key = `entry:${operationId}`;
      const existing = await this.ctx.storage.get(key);
      if (!existing) return json({ ok: true, alreadyGone: true, operationId });
      await this.ctx.storage.put(key, {
        ...existing,
        state: "replicated",
        replicatedAt: Date.now(),
        nextAttemptAt: null,
      });
      return json({ ok: true, operationId, state: "replicated" });
    }

    if (request.method === "GET" && entryMatch) {
      const entry = await this.ctx.storage.get(`entry:${entryMatch[1]}`);
      if (!entry) return json({ error: "not_found" }, 404);
      return json({
        operationId: entry.operationId,
        state: entry.state,
        createdAt: entry.createdAt,
        replicatedAt: entry.replicatedAt,
        attemptCount: entry.attemptCount,
        nextAttemptAt: entry.nextAttemptAt,
      });
    }

    return json({ error: "not_found" }, 404);
  }

  async signedCallback(body) {
    const callbackUrl = new URL(String(this.env.KLYX_RECOVERY_CALLBACK_URL || ""));
    if (callbackUrl.protocol !== "https:") throw new Error("KLYX_WAL_CALLBACK_URL_INVALID");
    const secret = String(this.env.KLYX_INDEPENDENT_WAL_HMAC_SECRET || "");
    if (encoder.encode(secret).byteLength < 32) throw new Error("KLYX_WAL_HMAC_SECRET_INVALID");

    const timestamp = String(Date.now());
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const canonical = [
      "POST",
      callbackUrl.pathname,
      timestamp,
      nonce,
      await sha256Hex(body),
    ].join("\n");
    const signature = await hmacHex(secret, canonical);

    return fetch(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-klyx-wal-timestamp": timestamp,
        "x-klyx-wal-nonce": nonce,
        "x-klyx-wal-signature": signature,
      },
      body,
    });
  }

  async cleanupNonces(now) {
    const nonces = await this.ctx.storage.list({ prefix: "nonce:" });
    const expired = [];
    for (const [key, expiresAt] of nonces) {
      if (Number(expiresAt) <= now) expired.push(key);
    }
    if (expired.length) await this.ctx.storage.delete(expired);
  }

  async alarm() {
    const now = Date.now();
    await this.cleanupNonces(now);
    const entries = await this.ctx.storage.list({ prefix: "entry:" });
    let nextAlarm = null;

    for (const [key, entry] of entries) {
      if (entry.state === "replicated") {
        if (entry.replicatedAt && now - entry.replicatedAt > REPLICATED_RETENTION_MS) {
          await this.ctx.storage.delete(key);
        }
        continue;
      }

      const due = Number(entry.nextAttemptAt || 0);
      if (due > now) {
        nextAlarm = nextAlarm === null ? due : Math.min(nextAlarm, due);
        continue;
      }

      try {
        const response = await this.signedCallback(JSON.stringify({ envelope: entry.envelope }));
        if (response.ok) {
          await this.ctx.storage.put(key, {
            ...entry,
            state: "replicated",
            replicatedAt: Date.now(),
            nextAttemptAt: null,
          });
          continue;
        }
      } catch (error) {
        console.error("KLYX WAL recovery callback failed", entry.operationId, error);
      }

      const attemptCount = Number(entry.attemptCount || 0) + 1;
      const nextAttemptAt = Date.now() + retryDelayMs(attemptCount);
      await this.ctx.storage.put(key, { ...entry, attemptCount, nextAttemptAt });
      nextAlarm = nextAlarm === null ? nextAttemptAt : Math.min(nextAlarm, nextAttemptAt);
    }

    if (nextAlarm !== null) await this.ctx.storage.setAlarm(nextAlarm);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/v1/health") {
      return json({ ok: true, service: "klyx-independent-wal", durable: true });
    }
    const id = env.KLYX_WAL.idFromName("global");
    return env.KLYX_WAL.get(id).fetch(request);
  },
};
