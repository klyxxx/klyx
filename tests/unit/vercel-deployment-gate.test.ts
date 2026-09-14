import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("KLYX Vercel deployment gate", () => {
  it("disables every Git-triggered Vercel deployment without changing the existing cron", () => {
    const config = JSON.parse(read("vercel.json")) as {
      git?: { deploymentEnabled?: boolean };
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.git).toEqual({ deploymentEnabled: false });
    expect(config.crons).toEqual([
      {
        path: "/api/ops/elmah-heartbeat",
        schedule: "17 3 * * *",
      },
    ]);
  });

  it("binds manual production deployment to exact-main metadata and the central release authority", () => {
    const script = read("scripts/operations/deploy-production-manual.ps1");

    expect(script).toContain("origin/main");
    expect(script).toContain("KLYX Security Certification");
    expect(script).toContain("KLYX Golden Path");
    expect(script).toContain("KLYX E2E");
    expect(script).toContain("vercel build --prod");
    expect(script).toContain("vercel deploy --prebuilt --prod");
    expect(script).toContain('klyxMainSha=$sha');
    expect(script).toContain("central-klyx-chat");
    expect(script).toContain("npm run ops:smoke");
    expect(script).toContain("https://www.klyx.be");
  });

  it("documents the no-auto-deploy and rollback contract", () => {
    const contract = read("docs/operations/KLYX_DEPLOYMENT_GATE.md");

    expect(contract).toContain("Development chats never deploy KLYX");
    expect(contract).toContain("A pull request stops after merge");
    expect(contract).toContain("must not create Vercel production or preview deployments");
    expect(contract).toContain("Vercel Deploy Hooks must not be created or invoked");
    expect(contract).toContain("Only the central KLYX chat is authorized");
    expect(contract).toContain("klyxMainSha");
    expect(contract).toContain("/api/health");
    expect(contract).toContain("vercel rollback");
  });
});
