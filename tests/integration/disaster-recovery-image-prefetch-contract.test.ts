import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readWorkflow(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const fullRestore = readWorkflow(
  ".github/workflows/klyx-supabase-full-restore-drill.yml"
);
const goldenPath = readWorkflow(
  ".github/workflows/klyx-golden-path.yml"
);
const performance = readWorkflow(
  ".github/workflows/klyx-performance.yml"
);
const providerStorage = readWorkflow(
  ".github/workflows/klyx-provider-storage-golden.yml"
);
const economicChain = readWorkflow(
  ".github/workflows/klyx-economic-chain-real-conditions.yml"
);

const isolatedSupabaseWorkflows = [
  fullRestore,
  goldenPath,
  performance,
  providerStorage,
  economicChain,
];

describe("KLYX Supabase CI registry hardening", () => {
  it("forces Docker Hub after setup-cli in every isolated Supabase workflow", () => {
    for (const workflow of isolatedSupabaseWorkflows) {
      const setupIndex = workflow.indexOf("Setup Supabase CLI");
      const registryIndex = workflow.indexOf(
        "Use Docker Hub for Supabase CI images"
      );
      const startIndex = Math.max(
        workflow.indexOf("Start ephemeral"),
        workflow.indexOf("Warm Supabase Postgres image")
      );

      expect(setupIndex).toBeGreaterThan(-1);
      expect(registryIndex).toBeGreaterThan(setupIndex);
      expect(workflow).toContain(
        'SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io'
      );
      expect(startIndex).toBeGreaterThan(registryIndex);
    }
  });

  it("pins and prefetches the exact Docker Hub Supabase Postgres image before db dump", () => {
    expect(fullRestore).toContain(
      'KLYX_DR_SUPABASE_POSTGRES_IMAGE: "supabase/postgres:17.6.1.156"'
    );
    expect(fullRestore).not.toContain(
      'KLYX_DR_SUPABASE_POSTGRES_IMAGE: "ghcr.io/supabase/postgres:17.6.1.156"'
    );
    expect(fullRestore).toContain(
      "Warm Supabase Postgres image with bounded transient retry"
    );
    expect(fullRestore).toContain('docker image inspect "$image"');
    expect(fullRestore).toContain('docker pull "$image"');

    const warmIndex = fullRestore.indexOf(
      "Warm Supabase Postgres image with bounded transient retry"
    );
    const dumpIndex = fullRestore.indexOf(
      "Capture production logical database snapshot"
    );

    expect(warmIndex).toBeGreaterThan(-1);
    expect(dumpIndex).toBeGreaterThan(warmIndex);
  });

  it("retries only known transient registry/network failures", () => {
    expect(fullRestore).toContain("toomanyrequests");
    expect(fullRestore).toContain("429");
    expect(fullRestore).toContain("5[0-9][0-9]");
    expect(fullRestore).toContain("timeout");
    expect(fullRestore).toContain("connection reset");
    expect(fullRestore).toContain("unexpected eof");
    expect(fullRestore).toContain("temporary failure");
    expect(fullRestore).toContain("context deadline exceeded");
    expect(fullRestore).toContain(
      "Non-transient Docker image pull failure"
    );
  });

  it("uses bounded backoff and never converts registry failure into success", () => {
    expect(fullRestore).toContain("delays=(0 5 30 120 300)");
    expect(fullRestore).toContain("jitter=$((RANDOM % 11))");
    expect(fullRestore).toContain(
      "Unable to preload required Supabase Postgres image"
    );
    expect(fullRestore).not.toContain(
      'docker pull "$image" || true'
    );
  });
});
