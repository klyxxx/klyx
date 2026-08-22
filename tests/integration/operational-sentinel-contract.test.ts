import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GET, HEAD } from "../../app/api/health/route";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const sentinel = readRepoFile(
  "scripts/operations/check-public-production.mjs"
);
const workflow = readRepoFile(
  ".github/workflows/klyx-operational-sentinel.yml"
);
const runbook = readRepoFile(
  "docs/operations/KLYX_INCIDENT_RUNBOOK.md"
);
const recoveryGuide = readRepoFile("docs/KLYX_RECOVERY_GUIDE.md");

function runSentinel(extraEnv: Record<string, string>) {
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), "scripts/operations/check-public-production.mjs")],
      {
        env: {
          ...process.env,
          KLYX_PRODUCTION_URL: "",
          KLYX_OPERATIONAL_ALLOW_LOOPBACK: "",
          ...extraEnv,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function startLocalServer(
  handler: Parameters<typeof createServer>[0]
): Promise<{ server: Server; origin: string }> {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("KLYX test server did not expose a TCP address.");
  }

  return {
    server,
    origin: `http://127.0.0.1:${address.port}/`,
  };
}

async function closeServer(server: Server) {
  server.close();
  await once(server, "close");
}

describe("KLYX operational sentinel contract", () => {
  it("exposes a minimal no-store liveness response with no dependency details", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "klyx",
      check: "liveness",
    });

    const head = HEAD();
    expect(head.status).toBe(204);

    const source = readRepoFile("app/api/health/route.ts");
    expect(source).not.toMatch(/supabase|stripe|database|secret|process\.env/i);
  });

  it("performs only the allowlisted GET liveness and homepage requests", async () => {
    const seen: Array<{ method: string | undefined; url: string | undefined }> = [];
    const { server, origin } = await startLocalServer((request, response) => {
      seen.push({ method: request.method, url: request.url });

      if (request.url === "/api/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({ status: "ok", service: "klyx", check: "liveness" })
        );
        return;
      }

      if (request.url === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body>KLYX</body></html>");
        return;
      }

      response.writeHead(404);
      response.end();
    });

    try {
      const result = await runSentinel({
        KLYX_PRODUCTION_URL: origin,
        KLYX_OPERATIONAL_ALLOW_LOOPBACK: "1",
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("KLYX_OPERATIONAL_SENTINEL_OK");
      expect(seen).toEqual([
        { method: "GET", url: "/api/health" },
        { method: "GET", url: "/" },
      ]);
    } finally {
      await closeServer(server);
    }
  });

  it("refuses unsafe remote HTTP targets before making a request", async () => {
    const result = await runSentinel({
      KLYX_PRODUCTION_URL: "http://example.com/",
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Remote production targets must use HTTPS");
  });

  it("refuses redirects instead of following them", async () => {
    const { server, origin } = await startLocalServer((_request, response) => {
      response.writeHead(302, { Location: "https://example.com/" });
      response.end();
    });

    try {
      const result = await runSentinel({
        KLYX_PRODUCTION_URL: origin,
        KLYX_OPERATIONAL_ALLOW_LOOPBACK: "1",
      });

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("returned a redirect");
    } finally {
      await closeServer(server);
    }
  });

  it("keeps the scheduled workflow opt-in and read-only", () => {
    expect(workflow).toContain("name: KLYX Operational Sentinel");
    expect(workflow).toContain('cron: "17,47 * * * *"');
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("KLYX_OPERATIONAL_SENTINEL_ENABLED");
    expect(workflow).toContain("KLYX_PRODUCTION_URL");
    expect(workflow).toContain("node scripts/operations/check-public-production.mjs");
    expect(workflow).toContain("Method: GET only");
    expect(workflow).toContain("Mutations: none");
    expect(workflow).not.toMatch(/secrets\./);

    expect(sentinel).toContain('const ALLOWED_PATHS = ["/api/health", "/"]');
    expect(sentinel).toContain('method: "GET"');
    expect(sentinel).toContain('redirect: "manual"');
    expect(sentinel).toContain("AbortSignal.timeout(TIMEOUT_MS)");
    expect(sentinel).not.toMatch(/Authorization|Cookie|SUPABASE|STRIPE/);
    expect(sentinel).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  });

  it("documents incident boundaries without claiming unproved backups or external proofs", () => {
    expect(runbook).toContain("Source-code backups are **not** database backups.");
    expect(runbook).toContain("liveness endpoint only");
    expect(runbook).toContain("must not be described as completed until a real manual run has succeeded");
    expect(runbook).toContain("does not claim full managed Auth/Storage object recovery");
    expect(runbook).toContain("KLYX Stripe Network Test");
    expect(runbook).toContain("do not manually mark a booking `paid` or `refunded`");
    expect(runbook).toContain("A failed scheduled workflow is an operational alert in GitHub Actions");
    expect(recoveryGuide).toContain("docs/operations/KLYX_INCIDENT_RUNBOOK.md");
  });
});
