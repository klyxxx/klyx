const ALLOWED_STATES = new Set(["pending", "success", "failure", "error"]);

function requiredEnv(name) {
  const value = process.env[name]?.trim() ?? "";

  if (!value) {
    throw new Error(`${name} is required for the KLYX Golden main status publisher.`);
  }

  return value;
}

function normalizedState(value) {
  if (value === "requested" || value === "in_progress") {
    return "pending";
  }

  if (value === "completed:success") {
    return "success";
  }

  if (value.startsWith("completed:")) {
    return "failure";
  }

  if (ALLOWED_STATES.has(value)) {
    return value;
  }

  throw new Error(`Unsupported Golden status state: ${value}`);
}

function assertRepository(value) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("GITHUB_REPOSITORY is invalid.");
  }

  return value;
}

function assertSha(value) {
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error("KLYX_GOLDEN_HEAD_SHA must be a full Git commit SHA.");
  }

  return value;
}

function assertRunId(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error("KLYX_GOLDEN_RUN_ID must be numeric.");
  }

  return value;
}

async function main() {
  const token = requiredEnv("GITHUB_TOKEN");
  const repository = assertRepository(requiredEnv("GITHUB_REPOSITORY"));
  const sha = assertSha(requiredEnv("KLYX_GOLDEN_HEAD_SHA"));
  const runId = assertRunId(requiredEnv("KLYX_GOLDEN_RUN_ID"));
  const state = normalizedState(requiredEnv("KLYX_GOLDEN_WORKFLOW_STATE"));
  const apiUrl = requiredEnv("GITHUB_API_URL");
  const serverUrl = requiredEnv("GITHUB_SERVER_URL");

  if (apiUrl !== "https://api.github.com") {
    throw new Error("KLYX Golden status publisher requires the GitHub API origin.");
  }

  if (serverUrl !== "https://github.com") {
    throw new Error("KLYX Golden status publisher requires the GitHub web origin.");
  }

  const description =
    state === "pending"
      ? "Automatic main Golden Path is running"
      : state === "success"
        ? "Automatic main Golden Path passed"
        : "Automatic main Golden Path failed";

  const response = await fetch(
    `${apiUrl}/repos/${repository}/statuses/${sha}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state,
        context: "KLYX Golden Path main proof",
        description,
        target_url: `${serverUrl}/${repository}/actions/runs/${runId}`,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Unable to publish Golden main status (${response.status}): ${body.slice(0, 300)}`
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      published: true,
      state,
      context: "KLYX Golden Path main proof",
      runId,
      sha,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Golden main status publish failed: ${message}`);
  process.exitCode = 1;
});
