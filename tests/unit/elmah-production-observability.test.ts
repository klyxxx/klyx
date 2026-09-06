import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

const elmahRuntime = read("lib/elmah-io.ts");
const apiError = read("lib/api-error.ts");
const instrumentation = read("instrumentation.ts");
const healthRoute = read("app/api/health/route.ts");
const heartbeatRoute = read("app/api/ops/elmah-heartbeat/route.ts");
const deploymentScript = read("scripts/operations/elmah-deployment.mjs");
const vercelConfig = JSON.parse(read("vercel.json")) as {
  crons?: Array<{ path: string; schedule: string }>;
};
const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};

describe("KLYX elmah.io production observability", () => {
  it("keeps elmah.io credentials server-side and production-only", () => {
    expect(elmahRuntime).toContain('process.env.ELMAH_IO_API_KEY');
    expect(elmahRuntime).toContain('process.env.VERCEL_ENV !== "production"');
    expect(elmahRuntime).toContain('https://api.elmah.io');
    expect(elmahRuntime).toContain('api_key: apiKey');
    expect(elmahRuntime).not.toContain("NEXT_PUBLIC_ELMAH");
    expect(elmahRuntime).not.toContain("authorization:");
  });

  it("reports standardized API failures only for server errors", () => {
    expect(elmahRuntime).toContain("input.status < 500");
    expect(elmahRuntime).toContain("input.status > 599");
    expect(elmahRuntime).toContain("correlationId");
    expect(apiError).toContain("reportKlyxApiError");
    expect(apiError).toContain("status >= 500");
    expect(apiError).toContain("after(async () =>");
  });

  it("captures unhandled Next.js errors using route patterns, not raw request paths", () => {
    expect(instrumentation).toContain("onRequestError");
    expect(instrumentation).toContain("routePath: context.routePath");
    expect(instrumentation).not.toContain("routePath: request.path");
    expect(elmahRuntime).toContain("KLYX Next.js instrumentation");
  });

  it("does not transmit raw exception contents or request-private fields", () => {
    expect(elmahRuntime).not.toContain("error.stack");
    expect(elmahRuntime).not.toContain("error.message");
    expect(elmahRuntime).not.toContain("cookie");
    expect(elmahRuntime).not.toContain("userAgent");
    expect(elmahRuntime).not.toContain("remoteAddr");
    expect(elmahRuntime).not.toContain("request.body");
  });

  it("exposes a minimal no-store health endpoint", () => {
    expect(healthRoute).toContain('status: "ok"');
    expect(healthRoute).toContain('service: "klyx"');
    expect(healthRoute).toContain('"Cache-Control": "no-store"');
    expect(healthRoute).not.toContain("process.env");
  });

  it("keeps the heartbeat authenticated and safe when configuration is absent", () => {
    expect(heartbeatRoute).toContain("CRON_SECRET");
    expect(heartbeatRoute).toContain("Bearer ${cronSecret}");
    expect(heartbeatRoute).toContain("isKlyxElmahHeartbeatConfigured");
    expect(heartbeatRoute).toContain("status: 204");
    expect(elmahRuntime).toContain("ELMAH_IO_HEARTBEAT_ID");
  });

  it("uses a Hobby-safe daily Vercel cron", () => {
    expect(vercelConfig.crons).toEqual([
      {
        path: "/api/ops/elmah-heartbeat",
        schedule: "17 3 * * *",
      },
    ]);
  });

  it("tracks only successful production builds and never fails the build on elmah.io errors", () => {
    expect(packageJson.scripts?.build).toBe(
      "next build && node scripts/operations/elmah-deployment.mjs"
    );
    expect(deploymentScript).toContain('process.env.VERCEL_ENV !== "production"');
    expect(deploymentScript).toContain("ELMAH_IO_API_KEY");
    expect(deploymentScript).toContain("/v3/deployments");
    expect(deploymentScript).toContain("KLYX_ELMAH_IO_DEPLOYMENT_FAILED");
    expect(deploymentScript).not.toContain("process.exit(1)");
  });
});
