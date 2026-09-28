import "server-only";

import {
  createHash,
  randomUUID,
  sign as cryptoSign,
  timingSafeEqual,
} from "node:crypto";
import {
  connect as connectHttp2,
  constants as http2Constants,
  type ClientHttp2Session,
} from "node:http2";

import { supabaseAdmin } from "@/lib/supabase-admin";

type PushPlatform = "ios" | "android";

type ClaimedPush = {
  id: string;
  notification_id: string;
  installation_id: string;
  recipient_profile_id: string;
  attempt_count: number;
};

type InstallationRow = {
  installation_id: string;
  account_id: string;
  auth_user_id: string;
  platform: PushPlatform;
  native_token: string;
  enabled: boolean;
  invalidated_at: string | null;
};

type NotificationRow = {
  id: string;
};

type ProfileRow = {
  id: string;
  account_id: string | null;
  owner_user_id: string;
};

type DeliveryResult = {
  delivered: boolean;
  invalidToken: boolean;
  error?: string;
};

type TickCounters = {
  claimed: number;
  sent: number;
  retried: number;
  dead: number;
  invalidated: number;
};

let fcmAccessTokenCache:
  | { token: string; expiresAtMs: number }
  | undefined;
let apnsJwtCache:
  | { token: string; expiresAtMs: number }
  | undefined;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function assertMobilePushProviderConfig(): void {
  for (const name of [
    "KLYX_FCM_PROJECT_ID",
    "KLYX_FCM_CLIENT_EMAIL",
    "KLYX_FCM_PRIVATE_KEY",
    "KLYX_APNS_TEAM_ID",
    "KLYX_APNS_KEY_ID",
    "KLYX_APNS_PRIVATE_KEY",
  ]) {
    if (!process.env[name]?.trim()) {
      throw new Error("KLYX_MOBILE_PUSH_WORKER_CONFIG_MISSING");
    }
  }

  const apnsEnvironment =
    process.env.KLYX_APNS_ENV?.trim().toLowerCase() || "production";
  if (apnsEnvironment !== "production" && apnsEnvironment !== "sandbox") {
    throw new Error("KLYX_MOBILE_PUSH_WORKER_CONFIG_MISSING");
  }
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function base64Url(value: string | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer.toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeHashEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function jwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  algorithm: "RS256" | "ES256",
  privateKey: string
): string {
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload)
  )}`;
  const signature = cryptoSign(
    "sha256",
    Buffer.from(signingInput, "utf8"),
    algorithm === "ES256"
      ? {
          key: normalizePrivateKey(privateKey),
          dsaEncoding: "ieee-p1363",
        }
      : normalizePrivateKey(privateKey)
  );
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function fcmAccessToken(): Promise<string> {
  if (
    fcmAccessTokenCache &&
    fcmAccessTokenCache.expiresAtMs > Date.now() + 60_000
  ) {
    return fcmAccessTokenCache.token;
  }

  const clientEmail = env("KLYX_FCM_CLIENT_EMAIL");
  const privateKey = env("KLYX_FCM_PRIVATE_KEY");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = jwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    },
    "RS256",
    privateKey
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string }
    | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(`KLYX_FCM_OAUTH_FAILED:${response.status}`);
  }

  fcmAccessTokenCache = {
    token: body.access_token,
    expiresAtMs: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

async function sendFcm(
  token: string,
  notification: NotificationRow
): Promise<DeliveryResult> {
  const projectId = env("KLYX_FCM_PROJECT_ID");
  const accessToken = await fcmAccessToken();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: "KLYX",
            body: "Tu as une nouvelle activité dans KLYX.",
          },
          data: {
            notificationId: notification.id,
            href: "/notifications",
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "klyx-default",
              sound: "default",
            },
          },
        },
      }),
    }
  );

  if (response.ok) return { delivered: true, invalidToken: false };

  const body = await response.text();
  const invalidToken =
    body.includes("UNREGISTERED") ||
    body.includes("registration-token-not-registered");

  return {
    delivered: false,
    invalidToken,
    error: `FCM_${response.status}:${body.slice(0, 500)}`,
  };
}

function apnsProviderJwt(): string {
  if (apnsJwtCache && apnsJwtCache.expiresAtMs > Date.now() + 60_000) {
    return apnsJwtCache.token;
  }

  const teamId = env("KLYX_APNS_TEAM_ID");
  const keyId = env("KLYX_APNS_KEY_ID");
  const privateKey = env("KLYX_APNS_PRIVATE_KEY");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = jwt(
    { alg: "ES256", kid: keyId },
    { iss: teamId, iat: nowSeconds },
    "ES256",
    privateKey
  );

  // Apple provider tokens are valid for one hour. Refresh before 50 minutes.
  apnsJwtCache = {
    token,
    expiresAtMs: Date.now() + 50 * 60 * 1000,
  };
  return token;
}

function apnsRequest(
  client: ClientHttp2Session,
  token: string,
  notification: NotificationRow
): Promise<DeliveryResult> {
  const providerToken = apnsProviderJwt();
  const bundleId = process.env.KLYX_APNS_BUNDLE_ID?.trim() || "app.klyx.mobile";

  return new Promise((resolve, reject) => {
    const request = client.request({
      [http2Constants.HTTP2_HEADER_METHOD]: "POST",
      [http2Constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let body = "";

    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[http2Constants.HTTP2_HEADER_STATUS] ?? 0);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("error", reject);
    request.on("end", () => {
      if (status === 200) {
        resolve({ delivered: true, invalidToken: false });
        return;
      }

      const invalidToken =
        status === 410 ||
        body.includes("BadDeviceToken") ||
        body.includes("DeviceTokenNotForTopic") ||
        body.includes("Unregistered");

      resolve({
        delivered: false,
        invalidToken,
        error: `APNS_${status}:${body.slice(0, 500)}`,
      });
    });

    request.end(
      JSON.stringify({
        aps: {
          alert: {
            title: "KLYX",
            body: "Tu as une nouvelle activité dans KLYX.",
          },
          sound: "default",
        },
        notificationId: notification.id,
        href: "/notifications",
      })
    );
  });
}

async function sendApns(
  token: string,
  notification: NotificationRow
): Promise<DeliveryResult> {
  const environment = process.env.KLYX_APNS_ENV?.trim().toLowerCase();
  const origin =
    environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  const client = connectHttp2(origin);

  try {
    return await apnsRequest(client, token, notification);
  } finally {
    client.close();
  }
}

async function markQueue(
  id: string,
  input: {
    state: "sent" | "retry" | "dead";
    error?: string | null;
    availableAt?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("mobile_push_outbox")
    .update({
      state: input.state,
      last_error: input.error?.slice(0, 2000) ?? null,
      available_at: input.availableAt ?? now,
      sent_at: input.state === "sent" ? now : null,
      claimed_at: null,
      lease_owner: null,
      updated_at: now,
    })
    .eq("id", id);

  if (error) throw error;
}

async function invalidateInstallation(installationId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("mobile_push_installations")
    .update({
      enabled: false,
      invalidated_at: now,
      updated_at: now,
    })
    .eq("installation_id", installationId);

  if (error) throw error;
}

function retryAt(attemptCount: number): string {
  const delaySeconds = [60, 300, 900, 3600, 21600, 21600][
    Math.min(Math.max(attemptCount - 1, 0), 5)
  ];
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

async function processClaim(
  claim: ClaimedPush,
  counters: TickCounters
): Promise<void> {
  const [installationResult, notificationResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("mobile_push_installations")
      .select(
        "installation_id, account_id, auth_user_id, platform, native_token, enabled, invalidated_at"
      )
      .eq("installation_id", claim.installation_id)
      .maybeSingle(),
    supabaseAdmin
      .from("user_notifications")
      .select("id")
      .eq("id", claim.notification_id)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("id, account_id, owner_user_id")
      .eq("id", claim.recipient_profile_id)
      .maybeSingle(),
  ]);

  if (installationResult.error) throw installationResult.error;
  if (notificationResult.error) throw notificationResult.error;
  if (profileResult.error) throw profileResult.error;

  const installation = installationResult.data as InstallationRow | null;
  const notification = notificationResult.data as NotificationRow | null;
  const profile = profileResult.data as ProfileRow | null;

  if (
    !installation ||
    !notification ||
    !profile ||
    !installation.enabled ||
    installation.invalidated_at !== null ||
    profile.account_id !== installation.account_id ||
    profile.owner_user_id !== installation.auth_user_id
  ) {
    await markQueue(claim.id, {
      state: "dead",
      error: "KLYX_MOBILE_PUSH_TARGET_INVALID",
    });
    counters.dead += 1;
    return;
  }

  let result: DeliveryResult;
  try {
    result =
      installation.platform === "android"
        ? await sendFcm(installation.native_token, notification)
        : await sendApns(installation.native_token, notification);
  } catch (error) {
    result = {
      delivered: false,
      invalidToken: false,
      error:
        error instanceof Error
          ? error.message
          : "KLYX_MOBILE_PUSH_PROVIDER_FAILED",
    };
  }

  if (result.delivered) {
    await markQueue(claim.id, { state: "sent" });
    counters.sent += 1;
    return;
  }

  if (result.invalidToken) {
    await invalidateInstallation(claim.installation_id);
    await markQueue(claim.id, {
      state: "dead",
      error: result.error ?? "KLYX_MOBILE_PUSH_TOKEN_INVALID",
    });
    counters.invalidated += 1;
    counters.dead += 1;
    return;
  }

  if (claim.attempt_count >= 7) {
    await markQueue(claim.id, {
      state: "dead",
      error: result.error ?? "KLYX_MOBILE_PUSH_RETRY_EXHAUSTED",
    });
    counters.dead += 1;
    return;
  }

  await markQueue(claim.id, {
    state: "retry",
    error: result.error ?? "KLYX_MOBILE_PUSH_RETRY",
    availableAt: retryAt(claim.attempt_count),
  });
  counters.retried += 1;
}

export async function authorizeMobilePushTick(rawToken: string): Promise<void> {
  if (!rawToken) throw new Error("KLYX_MOBILE_PUSH_WORKER_AUTH_INVALID");

  const { data, error } = await supabaseAdmin
    .from("ops_mobile_push_scheduler")
    .select("enabled, token_sha256")
    .eq("scheduler_key", "mobile_push_tick")
    .maybeSingle();

  if (error) throw error;
  if (!data?.enabled) throw new Error("KLYX_MOBILE_PUSH_WORKER_DISABLED");
  if (!data.token_sha256) {
    throw new Error("KLYX_MOBILE_PUSH_WORKER_CONFIG_MISSING");
  }

  if (!safeHashEqual(sha256(rawToken), data.token_sha256)) {
    throw new Error("KLYX_MOBILE_PUSH_WORKER_AUTH_INVALID");
  }

  // Missing provider credentials must fail before any queue claim can consume
  // an attempt. Activation remains an explicit readiness state.
  assertMobilePushProviderConfig();
}

export async function runMobilePushTick(): Promise<{
  workerId: string;
  counters: TickCounters;
}> {
  const workerId = `mobile-push-${randomUUID()}`;
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_claim_mobile_push_outbox",
    { p_worker: workerId, p_limit: 40 }
  );

  if (error) throw error;
  const claims = (data ?? []) as ClaimedPush[];
  const counters: TickCounters = {
    claimed: claims.length,
    sent: 0,
    retried: 0,
    dead: 0,
    invalidated: 0,
  };

  for (const claim of claims) {
    try {
      await processClaim(claim, counters);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "KLYX_MOBILE_PUSH_PROCESS_FAILED";
      if (claim.attempt_count >= 7) {
        await markQueue(claim.id, { state: "dead", error: message });
        counters.dead += 1;
      } else {
        await markQueue(claim.id, {
          state: "retry",
          error: message,
          availableAt: retryAt(claim.attempt_count),
        });
        counters.retried += 1;
      }
    }
  }

  return { workerId, counters };
}
