const ELMAH_IO_API_ORIGIN = "https://api.elmah.io";
const KLYX_ELMAH_IO_LOG_ID = "bac0ae51-d911-4ab5-8263-60a1e96b58ec";
const TIMEOUT_MS = 2_500;

function safeVersion(value) {
  const normalized = value?.trim();
  if (!normalized || !/^[0-9a-f]{7,40}$/i.test(normalized)) {
    return null;
  }

  return normalized.slice(0, 12).toLowerCase();
}

function safeDescription(value) {
  const normalized = value
    ?.replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  return normalized || "KLYX production deployment";
}

async function notifyDeployment() {
  if (process.env.VERCEL_ENV !== "production") {
    return;
  }

  const apiKey = process.env.ELMAH_IO_API_KEY?.trim();
  const version = safeVersion(process.env.VERCEL_GIT_COMMIT_SHA);

  if (!apiKey || !version) {
    return;
  }

  const body = new URLSearchParams({
    version,
    description: safeDescription(process.env.VERCEL_GIT_COMMIT_MESSAGE),
    logId: KLYX_ELMAH_IO_LOG_ID,
  });

  try {
    const response = await fetch(`${ELMAH_IO_API_ORIGIN}/v3/deployments`, {
      method: "POST",
      headers: {
        api_key: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        JSON.stringify({
          marker: "KLYX_ELMAH_IO_DEPLOYMENT_FAILED",
          status: response.status,
          version,
        })
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        marker: "KLYX_ELMAH_IO_DEPLOYMENT_FAILED",
        status: 0,
        version,
        errorName: error instanceof Error ? error.name : "UnknownError",
      })
    );
  }
}

await notifyDeployment();
