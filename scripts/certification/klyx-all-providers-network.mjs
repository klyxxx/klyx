import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";

const outDir = path.join(process.cwd(), "reports", "certification");
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const sha = process.env.GITHUB_SHA || process.env.KLYX_CERT_SHA || "unknown";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_SECRET:${name}`);
  return value;
}

async function request(url, options = {}, timeoutMs = 10_000) {
  return fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function probe(provider, mode, fn) {
  const startedAt = Date.now();
  try {
    const evidence = await fn();
    results.push({
      provider,
      status: "PASS",
      mode,
      durationMs: Date.now() - startedAt,
      evidence,
    });
  } catch (error) {
    results.push({
      provider,
      status: "FAIL",
      mode,
      durationMs: Date.now() - startedAt,
      evidence: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }
}

await probe("stripe", "TEST_READ_ONLY", async () => {
  const secret = required("KLYX_STRIPE_TEST_SECRET_KEY");
  if (!secret.startsWith("sk_test_")) throw new Error("REFUSE_NON_TEST_STRIPE_KEY");
  const response = await request("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error(`STRIPE_HTTP_${response.status}`);
  const body = await response.json();
  if (body?.livemode !== false) throw new Error("STRIPE_NOT_TEST_MODE");
  return "authenticated Stripe TEST account via GET /v1/account; no write performed";
});

await probe("twilio", "READ_ONLY", async () => {
  const serviceSid = required("TWILIO_VERIFY_SERVICE_SID");
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const username = apiKeySid && apiKeySecret ? apiKeySid : accountSid;
  const password = apiKeySid && apiKeySecret ? apiKeySecret : authToken;
  if (!username || !password) throw new Error("MISSING_TWILIO_CREDENTIALS");
  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await request(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}`,
    { headers: { Authorization: `Basic ${basic}` } }
  );
  if (!response.ok) throw new Error(`TWILIO_HTTP_${response.status}`);
  return "Twilio Verify service authenticated by read-only service lookup; no SMS sent";
});

await probe("sumsub", "READ_ONLY", async () => {
  const appToken = required("SUMSUB_APP_TOKEN");
  const secretKey = required("SUMSUB_SECRET_KEY");
  const externalUserId = `klyx-cert-readonly-${sha.slice(0, 12)}`;
  const apiPath = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secretKey)
    .update(`${timestamp}GET${apiPath}`)
    .digest("hex");
  const response = await request(`https://api.sumsub.com${apiPath}`, {
    headers: {
      Accept: "application/json",
      "X-App-Token": appToken,
      "X-App-Access-Ts": timestamp,
      "X-App-Access-Sig": signature,
    },
  });
  if (response.status === 401 || response.status === 403 || response.status >= 500) {
    throw new Error(`SUMSUB_HTTP_${response.status}`);
  }
  if (![200, 404].includes(response.status)) throw new Error(`SUMSUB_UNEXPECTED_HTTP_${response.status}`);
  return `Sumsub signed read-only lookup authenticated (HTTP ${response.status}); no applicant created`;
});

await probe("tolgee", "READ_ONLY", async () => {
  const apiKey = required("TOLGEE_API_KEY");
  const response = await request(
    "https://app.tolgee.io/v2/projects/34751/keys?size=1&page=0",
    { headers: { Accept: "application/json", "X-API-Key": apiKey } }
  );
  if (!response.ok) throw new Error(`TOLGEE_HTTP_${response.status}`);
  return "Tolgee project 34751 authenticated with read-only key listing";
});

await probe("resend", "READ_ONLY", async () => {
  const apiKey = required("RESEND_API_KEY");
  const response = await request("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`RESEND_HTTP_${response.status}`);
  const body = await response.json();
  const domains = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  const domain = domains.find((item) => item?.name === "klyx.be");
  if (!domain) throw new Error("RESEND_KLYX_DOMAIN_MISSING");
  if (domain.status !== "verified") throw new Error(`RESEND_DOMAIN_${String(domain.status).toUpperCase()}`);
  return "Resend klyx.be domain is verified through provider API; no email sent";
});

await probe("openai", "READ_ONLY", async () => {
  const apiKey = required("OPENAI_API_KEY");
  const response = await request("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
  return "OpenAI API authenticated by read-only model listing; no generation requested";
});

await probe("cloudflare", "PUBLIC_READ_ONLY", async () => {
  const response = await request("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  if (!response.ok) throw new Error(`CLOUDFLARE_TURNSTILE_HTTP_${response.status}`);
  const text = await response.text();
  if (!text || text.length < 100) throw new Error("CLOUDFLARE_TURNSTILE_EMPTY");
  return "Cloudflare Turnstile client endpoint reachable";
});

await probe("elmah.io", "READ_ONLY", async () => {
  const apiKey = required("ELMAH_IO_API_KEY");
  const logId = "bac0ae51-d911-4ab5-8263-60a1e96b58ec";
  const response = await request(`https://api.elmah.io/v3/messages/${logId}?pageSize=1`, {
    headers: { api_key: apiKey, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`ELMAH_IO_HTTP_${response.status}`);
  return "elmah.io production log authenticated by read-only message query";
});

await probe("supabase", "PRODUCTION_READ_ONLY", async () => {
  const origin = (process.env.KLYX_PRODUCTION_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!origin) throw new Error("MISSING_SECRET:NEXT_PUBLIC_SUPABASE_URL");
  if (/localhost|127\.0\.0\.1/.test(origin)) throw new Error("REFUSE_LOCAL_SUPABASE_AS_PROVIDER_PROOF");
  const response = await request(`${origin.replace(/\/$/, "")}/auth/v1/health`);
  if (!response.ok) throw new Error(`SUPABASE_AUTH_HEALTH_HTTP_${response.status}`);
  return "Supabase production Auth health endpoint reachable; read-only probe";
});

const report = {
  schemaVersion: 1,
  sha,
  generatedAt: new Date().toISOString(),
  safety: {
    stripeLiveWrites: false,
    networkMutations: false,
    probes: "GET/read-only only",
  },
  overall: results.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
  providers: results,
};

const jsonPath = path.join(outDir, "all-providers-network.json");
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (report.overall !== "PASS") process.exitCode = 1;
