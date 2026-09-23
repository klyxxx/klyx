import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs
  .readFileSync(
    path.join(
      process.cwd(),
      ".github/workflows/klyx-supabase-full-restore-drill.yml"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX full restore Supabase image prefetch", () => {
  it("pins and prefetches the exact Supabase Postgres image before db dump", () => {
    expect(workflow).toContain(
      'KLYX_DR_SUPABASE_POSTGRES_IMAGE: "ghcr.io/supabase/postgres:17.6.1.156"'
    );
    expect(workflow).toContain(
      "Warm Supabase Postgres image with bounded transient retry"
    );
    expect(workflow).toContain('docker image inspect "$image"');
    expect(workflow).toContain('docker pull "$image"');

    const warmIndex = workflow.indexOf(
      "Warm Supabase Postgres image with bounded transient retry"
    );
    const dumpIndex = workflow.indexOf(
      "Capture production logical database snapshot"
    );

    expect(warmIndex).toBeGreaterThan(-1);
    expect(dumpIndex).toBeGreaterThan(warmIndex);
  });

  it("retries only known transient registry/network failures", () => {
    expect(workflow).toContain("toomanyrequests");
    expect(workflow).toContain("429");
    expect(workflow).toContain("5[0-9][0-9]");
    expect(workflow).toContain("timeout");
    expect(workflow).toContain("connection reset");
    expect(workflow).toContain("unexpected eof");
    expect(workflow).toContain("temporary failure");
    expect(workflow).toContain("context deadline exceeded");
    expect(workflow).toContain("Non-transient Docker image pull failure");
  });

  it("uses bounded backoff and never converts registry failure into success", () => {
    expect(workflow).toContain("delays=(0 5 30 120 300)");
    expect(workflow).toContain("jitter=$((RANDOM % 11))");
    expect(workflow).toContain("Unable to preload required Supabase Postgres image");
    expect(workflow).not.toContain("docker pull \"$image\" || true");
  });
});
