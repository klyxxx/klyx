import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const vitestBin =
  process.platform === "win32"
    ? path.join(process.cwd(), "node_modules", ".bin", "vitest.cmd")
    : path.join(process.cwd(), "node_modules", ".bin", "vitest");

const result = spawnSync(
  vitestBin,
  [
    "run",
    "tests/integration/durable-orchestration-certification.test.ts",
    "--reporter=verbose",
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      KLYX_AUTONOMOUS_OFFLINE_ONLY: "true",
      KLYX_LIVE_PAYMENTS_ENABLED: "false",
      KLYX_STRIPE_MODE: "offline-fake",
    },
    stdio: "inherit",
    shell: false,
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
