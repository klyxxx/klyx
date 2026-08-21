import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  findGoldenPathUserByEmail,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const CLEANING_SERVICE_SLUGS = [
  "menage-a-domicile",
  "cleaning",
  "menage",
  "ménage",
];

function preferredCleaningService(services) {
  for (const slug of CLEANING_SERVICE_SLUGS) {
    const service = services.find((candidate) => candidate.slug === slug);
    if (service) {
      return service;
    }
  }

  return undefined;
}

async function verifyDurableRateLimit({
  admin,
  e2eOrigin,
  publishableKey,
  email,
  password,
}) {
  const subject = `golden-rate-limit:${randomUUID()}`;
  const keyHash = createHash("sha256")
    .update(subject, "utf8")
    .digest("hex");
  const action = "golden_rate_limit_probe";
  const limit = 3;
  const windowSeconds = 60;

  try {
    const observed = [];

    for (let index = 0; index < 5; index += 1) {
      const { data, error } = await admin.rpc(
        "klyx_consume_api_rate_limit",
        {
          p_key_hash: keyHash,
          p_action: action,
          p_limit: limit,
          p_window_seconds: windowSeconds,
        }
      );

      if (error) {
        throw new Error(
          `Unable to consume golden rate limit: ${error.message}`
        );
      }

      const row = Array.isArray(data) ? data[0] : data;
      observed.push(row);
    }

    const expected = [
      { allowed: true, remaining: 2, count: 1 },
      { allowed: true, remaining: 1, count: 2 },
      { allowed: true, remaining: 0, count: 3 },
      { allowed: false, remaining: 0, count: 4 },
      { allowed: false, remaining: 0, count: 4 },
    ];

    for (let index = 0; index < expected.length; index += 1) {
      const row = observed[index];
      const wanted = expected[index];

      if (
        row?.allowed !== wanted.allowed ||
        Number(row?.remaining) !== wanted.remaining ||
        Number(row?.request_count) !== wanted.count
      ) {
        throw new Error(
          `Golden rate-limit sequence mismatch at call ${index + 1}: ${JSON.stringify(row)}`
        );
      }
    }

    if (Number(observed[3]?.retry_after_seconds) < 1) {
      throw new Error("Blocked golden rate-limit call must expose Retry-After.");
    }

    const { data: stored, error: storedError } = await admin
      .from("api_rate_limits")
      .select("key_hash, action, request_count")
      .eq("key_hash", keyHash)
      .eq("action", action)
      .single();

    if (storedError) {
      throw new Error(
        `Unable to inspect durable rate-limit row: ${storedError.message}`
      );
    }

    if (
      stored.key_hash !== keyHash ||
      stored.action !== action ||
      Number(stored.request_count) !== 4 ||
      stored.key_hash.includes(subject)
    ) {
      throw new Error("Durable rate-limit persistence is invalid.");
    }

    const userClient = createClient(e2eOrigin, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error(
        `Unable to authenticate rate-limit privilege probe: ${signInError.message}`
      );
    }

    const { error: forbiddenRpcError } = await userClient.rpc(
      "klyx_consume_api_rate_limit",
      {
        p_key_hash: keyHash,
        p_action: "authenticated_probe",
        p_limit: 1,
        p_window_seconds: 60,
      }
    );

    if (!forbiddenRpcError) {
      throw new Error(
        "Authenticated clients must not execute the server-only rate-limit RPC."
      );
    }

    const { error: forbiddenTableError } = await userClient
      .from("api_rate_limits")
      .select("key_hash")
      .limit(1);

    if (!forbiddenTableError) {
      throw new Error(
        "Authenticated clients must not read server-only rate-limit counters."
      );
    }

    await userClient.auth.signOut();

    return {
      durableRateLimitVerified: true,
      allowedBeforeLimit: limit,
      blockedAfterLimit: true,
      boundedRequestCount: Number(observed[4]?.request_count),
      authenticatedAccessDenied: true,
    };
  } finally {
    await admin
      .from("api_rate_limits")
      .delete()
      .eq("key_hash", keyHash)
      .eq("action", action);
  }
}

async function main() {
  const { e2eOrigin } = assertGoldenPathIsolation();
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const supabase = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const user = await findGoldenPathUserByEmail(supabase, email);

  if (!user) {
    throw new Error(
      "Dedicated golden-path auth user is missing from the isolated Supabase project."
    );
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, account_type, country_code, currency_code, city")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    throw new Error(
      `Unable to inspect golden-path profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error(
      "Dedicated golden-path account must own both a client and a provider profile."
    );
  }

  for (const [label, profile] of [
    ["client", client],
    ["provider", provider],
  ]) {
    if (profile.country_code !== "BE") {
      throw new Error(`${label} golden-path profile must use country_code=BE.`);
    }

    if (profile.currency_code !== "EUR") {
      throw new Error(`${label} golden-path profile must use currency_code=EUR.`);
    }
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .limit(500);

  if (servicesError) {
    throw new Error(
      `Unable to inspect the golden-path service catalog: ${servicesError.message}`
    );
  }

  const service = preferredCleaningService(services ?? []);

  if (!service) {
    throw new Error(
      "Golden-path Supabase needs a canonical cleaning/menage service in the services catalog."
    );
  }

  const rateLimitProof = await verifyDurableRateLimit({
    admin: supabase,
    e2eOrigin,
    publishableKey,
    email,
    password,
  });

  // IDs are non-secret fixture handles. Never print the dedicated email/password/keys.
  process.stdout.write(
    `${JSON.stringify({
      ready: true,
      clientProfileId: client.id,
      providerProfileId: provider.id,
      serviceId: service.id,
      serviceSlug: service.slug,
      ...rateLimitProof,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path preflight failed: ${message}`);
  process.exitCode = 1;
});
