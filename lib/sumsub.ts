import "server-only";

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "crypto";

const BASE_URL = "https://api.sumsub.com";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

export function getSumsubLevelName(): string {
  return requiredEnv("SUMSUB_LEVEL_NAME");
}

export function sumsubConfigured(): boolean {
  return Boolean(
    process.env.SUMSUB_APP_TOKEN?.trim() &&
      process.env.SUMSUB_SECRET_KEY?.trim() &&
      process.env.SUMSUB_LEVEL_NAME?.trim() &&
      process.env.SUMSUB_WEBHOOK_SECRET?.trim()
  );
}

export async function sumsubRequest<T>(params: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const appToken = requiredEnv("SUMSUB_APP_TOKEN");
  const secretKey = requiredEnv("SUMSUB_SECRET_KEY");
  const method = params.method.toUpperCase();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body =
    params.body === undefined
      ? ""
      : JSON.stringify(params.body);

  const signature = createHmac(
    "sha256",
    secretKey
  )
    .update(
      timestamp +
        method +
        params.path +
        body
    )
    .digest("hex");

  const response = await fetch(
    `${BASE_URL}${params.path}`,
    {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-App-Token": appToken,
        "X-App-Access-Ts": timestamp,
        "X-App-Access-Sig": signature,
      },
      body:
        method === "POST" ? body : undefined,
    }
  );

  const text = await response.text();

  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { description: text };
    }
  }

  if (!response.ok) {
    const description =
      typeof data === "object" &&
      data !== null &&
      "description" in data &&
      typeof (
        data as { description?: unknown }
      ).description === "string"
        ? (
            data as { description: string }
          ).description
        : `Erreur Sumsub ${response.status}.`;

    throw new Error(description);
  }

  return data as T;
}

export async function createSumsubSdkToken(params: {
  userId: string;
  email?: string | null;
}): Promise<{ token: string; userId?: string }> {
  const body: Record<string, unknown> = {
    userId: params.userId,
    levelName: getSumsubLevelName(),
    ttlInSecs: 600,
  };

  if (params.email) {
    body.applicantIdentifiers = {
      email: params.email,
    };
  }

  return sumsubRequest<{
    token: string;
    userId?: string;
  }>({
    method: "POST",
    path: "/resources/accessTokens/sdk",
    body,
  });
}

export function hashWebhookPayload(
  rawBody: string
): string {
  return createHash("sha256")
    .update(rawBody)
    .digest("hex");
}

export function verifySumsubWebhook(params: {
  rawBody: string;
  digest: string | null;
  algorithm: string | null;
}): boolean {
  const secret = requiredEnv(
    "SUMSUB_WEBHOOK_SECRET"
  );

  if (
    !params.digest ||
    !params.algorithm
  ) {
    return false;
  }

  const algorithmMap: Record<
    string,
    "sha256" | "sha512"
  > = {
    HMAC_SHA256_HEX: "sha256",
    HMAC_SHA512_HEX: "sha512",
  };

  const algorithm =
    algorithmMap[params.algorithm];

  if (!algorithm) {
    return false;
  }

  const calculated = createHmac(
    algorithm,
    secret
  )
    .update(params.rawBody)
    .digest("hex");

  try {
    const expected = Buffer.from(
      params.digest,
      "hex"
    );
    const actual = Buffer.from(
      calculated,
      "hex"
    );

    return (
      expected.length === actual.length &&
      timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
