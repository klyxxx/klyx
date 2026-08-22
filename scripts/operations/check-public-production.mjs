const TIMEOUT_MS = 10_000;
const USER_AGENT = "KLYX-Operational-Sentinel/1.0";
const ALLOWED_PATHS = ["/api/health", "/"];

function fail(message) {
  console.error(`KLYX_OPERATIONAL_SENTINEL_FAILED: ${message}`);
  process.exit(1);
}

function parseTarget() {
  const raw = (process.env.KLYX_PRODUCTION_URL || "").trim();
  if (!raw) {
    fail("KLYX_PRODUCTION_URL is required.");
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    fail("KLYX_PRODUCTION_URL must be a valid absolute URL.");
  }

  const hostname = target.hostname.toLowerCase();
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(hostname);
  const loopbackAllowed = process.env.KLYX_OPERATIONAL_ALLOW_LOOPBACK === "1";

  if (target.username || target.password) {
    fail("Credentials are forbidden in KLYX_PRODUCTION_URL.");
  }

  if (target.search || target.hash) {
    fail("Query strings and fragments are forbidden in KLYX_PRODUCTION_URL.");
  }

  if (target.pathname !== "/") {
    fail("KLYX_PRODUCTION_URL must target the deployment origin root.");
  }

  if (loopback) {
    if (!loopbackAllowed) {
      fail("Loopback targets require KLYX_OPERATIONAL_ALLOW_LOOPBACK=1.");
    }
  } else if (target.protocol !== "https:") {
    fail("Remote production targets must use HTTPS.");
  }

  return target;
}

async function fetchSameOrigin(target, pathname) {
  if (!ALLOWED_PATHS.includes(pathname)) {
    fail(`Refusing non-allowlisted path ${pathname}.`);
  }

  const url = new URL(pathname, target.origin);
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: pathname === "/api/health" ? "application/json" : "text/html,*/*;q=0.8",
        "Cache-Control": "no-cache",
        "User-Agent": USER_AGENT,
      },
    });
  } catch (error) {
    fail(
      `${pathname} request failed (${error instanceof Error ? error.name : "UnknownError"}).`
    );
  }

  if (response.status >= 300 && response.status < 400) {
    fail(`${pathname} returned a redirect; configure the canonical deployment origin directly.`);
  }

  const finalUrl = new URL(response.url);
  if (finalUrl.origin !== target.origin) {
    fail(`${pathname} escaped the configured production origin.`);
  }

  if (!response.ok) {
    fail(`${pathname} returned HTTP ${response.status}.`);
  }

  return response;
}

async function verifyHealth(target) {
  const response = await fetchSameOrigin(target, "/api/health");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    fail("/api/health did not return JSON.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    fail("/api/health returned invalid JSON.");
  }

  if (
    payload?.status !== "ok" ||
    payload?.service !== "klyx" ||
    payload?.check !== "liveness"
  ) {
    fail("/api/health returned an unexpected liveness payload.");
  }
}

async function verifyHomepage(target) {
  const response = await fetchSameOrigin(target, "/");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) {
    fail("Homepage did not return HTML.");
  }
}

async function main() {
  const target = parseTarget();
  await verifyHealth(target);
  await verifyHomepage(target);
  console.log(`KLYX_OPERATIONAL_SENTINEL_OK origin=${target.origin}`);
}

await main();
