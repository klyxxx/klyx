import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.KLYX_PERF_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const SUPABASE_URL = (__ENV.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = __ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const EMAIL = __ENV.KLYX_E2E_EMAIL || "";
const PASSWORD = __ENV.KLYX_E2E_PASSWORD || "";
const PROFILE = (__ENV.KLYX_PERF_PROFILE || "smoke").toLowerCase();

const journeyFailures = new Rate("klyx_journey_failures");
const searchDuration = new Trend("klyx_search_duration", true);
const authenticatedDuration = new Trend("klyx_authenticated_duration", true);

function profileScenario(profile) {
  switch (profile) {
    case "smoke":
      return {
        executor: "shared-iterations",
        vus: 1,
        iterations: 4,
        maxDuration: "30s",
      };
    case "ci":
      return {
        executor: "ramping-vus",
        startVUs: 1,
        stages: [
          { duration: "10s", target: 5 },
          { duration: "20s", target: 5 },
          { duration: "10s", target: 0 },
        ],
        gracefulRampDown: "5s",
      };
    case "load":
      return {
        executor: "ramping-vus",
        startVUs: 1,
        stages: [
          { duration: "30s", target: 20 },
          { duration: "1m", target: 20 },
          { duration: "15s", target: 0 },
        ],
        gracefulRampDown: "10s",
      };
    case "stress":
      return {
        executor: "ramping-vus",
        startVUs: 5,
        stages: [
          { duration: "30s", target: 20 },
          { duration: "30s", target: 40 },
          { duration: "30s", target: 60 },
          { duration: "45s", target: 60 },
          { duration: "20s", target: 0 },
        ],
        gracefulRampDown: "10s",
      };
    case "spike":
      return {
        executor: "ramping-vus",
        startVUs: 2,
        stages: [
          { duration: "5s", target: 75 },
          { duration: "20s", target: 75 },
          { duration: "10s", target: 2 },
          { duration: "10s", target: 0 },
        ],
        gracefulRampDown: "5s",
      };
    case "soak":
      return {
        executor: "constant-vus",
        vus: 10,
        duration: __ENV.KLYX_PERF_SOAK_DURATION || "15m",
        gracefulStop: "15s",
      };
    default:
      throw new Error(`Unknown KLYX performance profile: ${profile}`);
  }
}

export const options = {
  scenarios: {
    klyx_readonly_journey: profileScenario(PROFILE),
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(50)<350", "p(95)<900", "p(99)<1600"],
    checks: ["rate>0.99"],
    klyx_journey_failures: ["rate<0.01"],
    klyx_search_duration: ["p(95)<1000", "p(99)<1800"],
    klyx_authenticated_duration: ["p(95)<900", "p(99)<1600"],
  },
  summaryTrendStats: ["min", "avg", "med", "p(50)", "p(95)", "p(99)", "max"],
  discardResponseBodies: false,
  tags: {
    system: "klyx",
    profile: PROFILE,
    safety: "read-only",
  },
};

function assertSafeTarget() {
  const target = new URL(BASE_URL);
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(target.hostname);
  const remoteSmokeAllowed =
    PROFILE === "smoke" && __ENV.KLYX_PERF_ALLOW_REMOTE_READ_ONLY === "true";

  if (!loopback && !remoteSmokeAllowed) {
    throw new Error(
      `KLYX performance guard refused ${BASE_URL}. Non-loopback load/stress/spike/soak targets are forbidden.`
    );
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("KLYX performance target must use HTTP or HTTPS.");
  }
}

function tomorrowIsoDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function authenticate() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD) {
    return null;
  }

  const authResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      tags: { name: "supabase_auth" },
    }
  );

  const authOk = check(authResponse, {
    "Supabase test authentication succeeds": (response) => response.status === 200,
  });

  if (!authOk) return null;

  const auth = authResponse.json();
  const accessToken = auth?.access_token;
  const userId = auth?.user?.id;
  if (!accessToken || !userId) return null;

  const profileResponse = http.get(
    `${SUPABASE_URL}/rest/v1/profiles?owner_user_id=eq.${encodeURIComponent(
      userId
    )}&account_type=eq.client&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      tags: { name: "supabase_client_profile" },
    }
  );

  const profileOk = check(profileResponse, {
    "Dedicated performance client profile resolves": (response) =>
      response.status === 200 && Array.isArray(response.json()) && response.json().length === 1,
  });

  if (!profileOk) return null;

  return {
    accessToken,
    profileId: profileResponse.json()[0].id,
  };
}

export function setup() {
  assertSafeTarget();
  return {
    auth: authenticate(),
    date: tomorrowIsoDate(),
  };
}

export default function (data) {
  let failed = false;

  group("public shell", () => {
    const home = http.get(`${BASE_URL}/`, { tags: { name: "home" } });
    const login = http.get(`${BASE_URL}/login`, { tags: { name: "login_page" } });

    const ok = check(home, { "home responds": (response) => response.status === 200 }) &&
      check(login, { "login responds": (response) => response.status === 200 });
    failed ||= !ok;
  });

  let providerId = null;

  group("provider search", () => {
    const params = [
      "service=menage-a-domicile",
      "city=Bruxelles",
      `date=${encodeURIComponent(data.date)}`,
      "time=10%3A00",
      "duration=2",
      "sort=recommended",
    ].join("&");

    const response = http.get(`${BASE_URL}/api/search/providers?${params}`, {
      tags: { name: "provider_search" },
    });
    searchDuration.add(response.timings.duration);

    const ok = check(response, {
      "provider search succeeds": (result) => result.status === 200,
      "provider search returns JSON": (result) => {
        try {
          const body = result.json();
          return Array.isArray(body?.providers);
        } catch {
          return false;
        }
      },
    });
    failed ||= !ok;

    if (ok) {
      const body = response.json();
      providerId = body?.providers?.[0]?.profileId || null;
    }
  });

  if (providerId) {
    group("provider profile", () => {
      const response = http.get(`${BASE_URL}/providers/${providerId}`, {
        tags: { name: "provider_profile" },
      });
      const ok = check(response, {
        "provider profile responds": (result) => result.status === 200,
      });
      failed ||= !ok;
    });
  }

  if (data.auth) {
    group("authenticated client read", () => {
      const response = http.get(`${BASE_URL}/api/agent/plans`, {
        headers: {
          Authorization: `Bearer ${data.auth.accessToken}`,
          Cookie: `klyx_active_profile=${encodeURIComponent(data.auth.profileId)}`,
        },
        tags: { name: "agent_plans_read" },
      });
      authenticatedDuration.add(response.timings.duration);
      const ok = check(response, {
        "authenticated agent plans read succeeds": (result) => result.status === 200,
      });
      failed ||= !ok;
    });
  }

  journeyFailures.add(failed);
  sleep(PROFILE === "spike" ? 0.1 : 0.5);
}
